import { User as IUser } from 'abrechnung-common/types.js'
import { Job } from 'bullmq'
import escapeHtml from 'escape-html'
import { mongo, Types } from 'mongoose'
import ENV from '../../env.js'
import { createOperationServices } from '../../factory.js'
import { genAuthenticatedLink } from '../../helper.js'
import i18n, { updateI18n } from '../../i18n.js'
import { logger } from '../../logger.js'
import User from '../../models/user.js'
import { IntegrationJobData } from '../queue.js'
import { sendMail } from './email.js'
import { sendPushNotification } from './push.js'

function adminJobsUrl() {
  return `${ENV.VITE_FRONTEND_URL}/admin/integrations/worker-jobs`
}

async function mailLink(user: IUser<Types.ObjectId, mongo.Binary>) {
  if (!user.fk.magiclogin) return adminJobsUrl()
  try {
    return await genAuthenticatedLink({ destination: user.fk.magiclogin, redirect: '/admin/integrations/worker-jobs' })
  } catch (error) {
    logger.warn('Could not generate authenticated worker job link', error)
    return adminJobsUrl()
  }
}

export async function notifyAdminsAboutFailedJob(job: Job<IntegrationJobData>, error: Error) {
  const administrators = await User.find({
    'access.admin': true,
    'access.user': true,
    $or: [{ loseAccessAt: null }, { loseAccessAt: { $gt: new Date() } }]
  }).lean()
  const { connectionSettings, displaySettings } = createOperationServices().snapshot
  updateI18n(displaySettings.locale)
  const emailConfigured = Boolean(connectionSettings.smtp?.host)
  const pushConfigured = ENV.VITE_FRONTEND_URL.startsWith('https') && Boolean(ENV.PRIVATE_VAPID_KEY) && Boolean(ENV.VITE_PUBLIC_VAPID_KEY)

  const deliveries = administrators.flatMap((administrator) => {
    const language = administrator.settings.language
    const interpolation = { lng: language, job: job.name, id: job.id ?? '', error: error.message }
    const subject = i18n.t('mail.workerJobFailed.subject', interpolation)
    const paragraph = i18n.t('mail.workerJobFailed.paragraph', interpolation)
    const recipientDeliveries: Promise<unknown>[] = []

    if (emailConfigured) {
      recipientDeliveries.push(
        mailLink(administrator).then((link) =>
          sendMail(
            administrator,
            subject,
            escapeHtml(paragraph),
            language,
            { text: i18n.t('labels.workerJobs', { lng: language }), link },
            i18n.t('mail.workerJobFailed.lastParagraph', interpolation)
          )
        )
      )
    }
    if (pushConfigured) {
      recipientDeliveries.push(sendPushNotification(subject, paragraph, [administrator._id.toString()], adminJobsUrl()))
    }
    return recipientDeliveries
  })

  const results = await Promise.allSettled(deliveries)
  for (const result of results) {
    if (result.status === 'rejected') logger.error('Could not deliver worker job failure notification', result.reason)
  }
}
