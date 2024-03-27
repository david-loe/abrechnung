import ejs from 'ejs'
import fs from 'fs'
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
import i18n from '../i18n.js'
import User from '../models/user.js'
import mailClient from './client.js'

export function sendMail(
  recipients: IUser[],
  subject: string,
  paragaph: string,
  button: { text: string; link: string },
  lastParagraph: string
) {
  if (mailClient == undefined || recipients.length === 0) {
    return false
  }
  const language = recipients[0].settings.language
  var salutation = i18n.t('mail.hi', { lng: language })
  if (recipients.length === 1) {
    salutation = i18n.t('mail.hiX', { lng: language, X: recipients[0].name.givenName })
  }
  const regards = i18n.t('mail.regards', { lng: language })
  const app = {
    name: i18n.t('headlines.title', { lng: language }) + ' ' + i18n.t('headlines.emoji', { lng: language }),
    url: process.env.VITE_FRONTEND_URL
  }

  const template = fs.readFileSync('./templates/mail.ejs', { encoding: 'utf-8' })
  const renderedHTML = ejs.render(template, {
    salutation,
    paragaph,
    button,
    lastParagraph,
    regards,
    app
  })
  const plainText =
    salutation +
    '\n\n' +
    paragaph +
    '\n\n' +
    button.text +
    ': ' +
    button.link +
    '\n\n' +
    lastParagraph +
    '\n\n' +
    regards +
    '\n\n' +
    app.name +
    ': ' +
    app.url

  mailClient.sendMail({
    from: '"' + app.name + '" <' + process.env.MAIL_SENDER_ADDRESS + '>', // sender address
    to: recipients.map((r) => r.email), // list of receivers
    subject: subject, // Subject line
    text: plainText, // plain text body
    html: renderedHTML // html body
  })
}

export async function sendNotificationMail(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple, textState?: string) {
  var recipients = []
  var reportType: ReportType
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
  const userFilter: any = {}
  if (report.state === 'appliedFor') {
    userFilter[`access.approve/${reportType}`] = true
    button.link = `${process.env.VITE_FRONTEND_URL}/approve/${reportType}/${report._id}`
  } else if (report.state === 'underExamination') {
    userFilter[`access.examine/${reportType}`] = true
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

  const interpolation: { owner: string; lng: Locale; comment?: string; commentator?: string } = {
    owner: report.owner.name.givenName,
    lng: language
  }

  if (report.comments.length > 0) {
    const comment = report.comments[report.comments.length - 1]
    if (comment.toState == report.state) {
      interpolation.comment = comment.text
      interpolation.commentator = comment.author.name.givenName
    }
  }

  const subject = i18n.t(`mail.${reportType}.${textState ? textState : report.state}.subject`, interpolation)
  const paragraph = i18n.t(`mail.${reportType}.${textState ? textState : report.state}.paragraph`, interpolation)
  const lastParagraph = interpolation.comment
    ? i18n.t(`mail.${reportType}.${textState ? textState : report.state}.lastParagraph`, interpolation)
    : ''
  button.text = i18n.t('labels.viewX', { lng: language, X: i18n.t(`labels.${reportType}`, { lng: language }) })

  sendMail(recipients, subject, paragraph, button, lastParagraph)
}
