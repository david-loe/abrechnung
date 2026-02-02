import { Contact, User as IUser, Locale } from 'abrechnung-common/types.js'
import ejs from 'ejs'
import nodemailer from 'nodemailer'
import { mapSmtpConfig } from '../data/settingsValidator.js'
import { getConnectionSettings, getDisplaySettings } from '../db.js'
import ENV from '../env.js'
import { genAuthenticatedLink } from '../helper.js'
import i18n, { updateI18n } from '../i18n.js'
import { logger } from '../logger.js'
import { getMailTemplate } from '../templates/cache.js'
import { MailJobData, mailQueue } from '../workers/mail.js'

export async function getClient() {
  // NO BACKEND_CACHE bc used in worker
  const connectionSettings = await getConnectionSettings()
  if (connectionSettings.smtp?.host) {
    return nodemailer.createTransport(mapSmtpConfig(connectionSettings.smtp))
  }
  throw new Error('SMTP not configured in Connection Settings')
}
export type MailRecipient = Contact & { fk: IUser['fk']; settings: { language: IUser['settings']['language'] } }

export async function enqueueMail(
  recipients: MailRecipient[],
  subject: string,
  paragraph: string,
  button?: { text: string; link: string },
  lastParagraph?: string | string[],
  authenticateLink = true
) {
  const displaySettings = await getDisplaySettings(false)
  updateI18n(displaySettings.locale)
  for (const recipient of recipients) {
    const language = recipient.settings.language
    let recipientButton: { text: string; link: string } | undefined
    if (button) {
      recipientButton = { ...button }
      if (authenticateLink && recipient.fk.magiclogin && recipientButton.link.startsWith(ENV.VITE_FRONTEND_URL)) {
        recipientButton.link = await genAuthenticatedLink({
          destination: recipient.fk.magiclogin,
          redirect: recipientButton.link.substring(ENV.VITE_FRONTEND_URL.length)
        })
      }
    }
    await mailQueue.add('sendMail', { recipient, subject, paragraph, language, button: recipientButton, lastParagraph })
  }
}

export async function sendMail(
  recipient: Contact,
  subject: string,
  paragraph: string,
  language: Locale,
  button?: { text: string; link: string },
  lastParagraph?: string | string[]
) {
  const mailClient = await getClient()
  const salutation = i18n.t('mail.hiX', { lng: language, X: recipient.name.givenName })
  const regards = i18n.t('mail.regards', { lng: language })
  const app = {
    name: `${i18n.t('headlines.title', { lng: language })} ${i18n.t('headlines.emoji', { lng: language })}`,
    url: ENV.VITE_FRONTEND_URL
  }

  const template = await getMailTemplate()
  const renderedHTML = ejs.render(template, { salutation, paragraph, button, lastParagraph, regards, app })
  const plainText = `${salutation}\n\n${paragraph}\n\n${button ? `${button.text}: ${button.link}\n\n` : ''}${lastParagraph ? `${Array.isArray(lastParagraph) ? lastParagraph.join('\n') : lastParagraph}\n\n` : ''}${regards}\n\n${app.name}: ${app.url}`

  logger.debug(`Send mail to ${recipient.email}`)
  return await mailClient.sendMail({
    from: `"${app.name}" <${mailClient.options.from}>`, // sender address
    to: recipient.email, // list of receivers
    subject: subject, // Subject line
    text: plainText, // plain text body
    html: renderedHTML // html body
  })
}
