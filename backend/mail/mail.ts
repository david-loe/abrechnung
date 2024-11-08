import ejs from 'ejs'
import nodemailer from 'nodemailer'
import {
  ExpenseReportSimple,
  HealthCareCostSimple,
  User as IUser,
  Locale,
  ReportType,
  TravelSimple,
  reportIsHealthCareCost,
  reportIsTravel
} from '../../common/types.js'
import { getConnectionSettings } from '../db.js'
import { genAuthenticatedLink } from '../helper.js'
import i18n, { formatter } from '../i18n.js'
import User from '../models/user.js'
import { sendPushNotification } from '../push/push.js'
import { mapSmtpConfig } from '../settingsValidator.js'
import { getMailTemplate } from '../templates/cache.js'

export async function getClient() {
  const connectionSettings = await getConnectionSettings()
  if (connectionSettings.smtp?.host) {
    return nodemailer.createTransport(mapSmtpConfig(connectionSettings.smtp))
  } else {
    throw new Error('SMTP not configured in Connection Settings')
  }
}

export async function sendMail(
  recipients: IUser[],
  subject: string,
  paragraph: string,
  button?: { text: string; link: string },
  lastParagraph?: string,
  authenticateLink = true
) {
  const mailPromises = []
  for (let i = 0; i < recipients.length; i++) {
    const language = recipients[i].settings.language
    let recipientButton: { text: string; link: string } | undefined = undefined
    if (button) {
      recipientButton = { ...button }
      if (authenticateLink && recipients[i].fk.magiclogin && recipientButton.link.startsWith(process.env.VITE_FRONTEND_URL)) {
        recipientButton.link = await genAuthenticatedLink({
          destination: recipients[i].fk.magiclogin!,
          redirect: recipientButton.link.substring(process.env.VITE_FRONTEND_URL.length)
        })
      }
    }
    mailPromises.push(_sendMail(recipients[i], subject, paragraph, language, recipientButton, lastParagraph))
  }
  return await Promise.allSettled(mailPromises)
}

async function _sendMail(
  recipient: IUser,
  subject: string,
  paragraph: string,
  language: Locale,
  button?: { text: string; link: string },
  lastParagraph?: string
) {
  const mailClient = await getClient()
  const salutation = i18n.t('mail.hiX', { lng: language, X: recipient.name.givenName })
  const regards = i18n.t('mail.regards', { lng: language })
  const app = {
    name: i18n.t('headlines.title', { lng: language }) + ' ' + i18n.t('headlines.emoji', { lng: language }),
    url: process.env.VITE_FRONTEND_URL
  }

  const template = await getMailTemplate()
  const renderedHTML = ejs.render(template, {
    salutation,
    paragraph,
    button,
    lastParagraph,
    regards,
    app
  })
  const plainText =
    salutation +
    '\n\n' +
    paragraph +
    '\n\n' +
    (button ? button.text + ': ' + button.link + '\n\n' : '') +
    lastParagraph +
    '\n\n' +
    regards +
    '\n\n' +
    app.name +
    ': ' +
    app.url

  sendPushNotification(subject, paragaph, recipients, button.link)

  return await mailClient.sendMail({
    from: '"' + app.name + '" <' + mailClient.options.from + '>', // sender address
    to: recipient.email, // list of receivers
    subject: subject, // Subject line
    text: plainText, // plain text body
    html: renderedHTML // html body
  })
}

export async function sendNotificationMail(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple, textState?: string) {
  let recipients = []
  let reportType: ReportType
  if (reportIsTravel(report)) {
    reportType = 'travel'
  } else if (reportIsHealthCareCost(report)) {
    reportType = 'healthCareCost'
  } else {
    reportType = 'expenseReport'
  }
  const button = {
    text: '',
    link: ''
  }

  const supervisedProjectsFilter = {
    $or: [{ 'projects.supervised': [] }, { 'projects.supervised': report.project._id }]
  }
  const userFilter: any = {}
  if (report.state === 'appliedFor') {
    userFilter[`access.approve/${reportType}`] = true
    Object.assign(userFilter, supervisedProjectsFilter)
    button.link = `${process.env.VITE_FRONTEND_URL}/approve/${reportType}/${report._id}`
  } else if (report.state === 'underExamination') {
    userFilter[`access.examine/${reportType}`] = true
    Object.assign(userFilter, supervisedProjectsFilter)
    button.link = `${process.env.VITE_FRONTEND_URL}/examine/${reportType}/${report._id}`
  } else {
    // 'rejected', 'approved', 'refunded', 'underExaminationByInsurance'
    userFilter['_id'] = report.owner._id
    button.link =
      report.state === 'rejected'
        ? `${process.env.VITE_FRONTEND_URL}/${reportType}`
        : `${process.env.VITE_FRONTEND_URL}/${reportType}/${report._id}`
  }
  recipients = await User.find(userFilter).lean()
  if (recipients.length === 0) {
    return
  }
  const language = recipients[0].settings.language

  const interpolation: { owner: string; lng: Locale; comment?: string; commentator?: string; refundSum?: string } = {
    owner: report.owner.name.givenName,
    lng: language,
    refundSum: (report as HealthCareCostSimple).refundSum
      ? formatter.money((report as HealthCareCostSimple).refundSum, { locale: language })
      : undefined
  }

  if (report.comments.length > 0) {
    const comment = report.comments[report.comments.length - 1]
    if (comment.toState == report.state) {
      interpolation.comment = comment.text
      interpolation.commentator = comment.author.name.givenName
    }
  }

  const subject = i18n.t(`mail.${reportType}.${textState || report.state}.subject`, interpolation)
  const paragraph = i18n.t(`mail.${reportType}.${textState || report.state}.paragraph`, interpolation)
  const lastParagraph = interpolation.comment ? i18n.t(`mail.${reportType}.${textState || report.state}.lastParagraph`, interpolation) : ''
  button.text = i18n.t('labels.viewX', { lng: language, X: i18n.t(`labels.${reportType}`, { lng: language }) })
  sendMail(recipients, subject, paragraph, button, lastParagraph)
}
