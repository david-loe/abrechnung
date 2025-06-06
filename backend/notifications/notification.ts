import { RootFilterQuery } from 'mongoose'
import { getDiffInDays, PlaceToString } from '../../common/scripts.js'
import {
  Advance,
  ExpenseReportSimple,
  HealthCareCostSimple,
  User as IUser,
  Locale,
  ReportType,
  reportIsAdvance,
  reportIsHealthCareCost,
  reportIsTravel,
  State,
  TravelSimple
} from '../../common/types.js'
import { getDisplaySettings } from '../db.js'
import { formatter } from '../factory.js'
import i18n from '../i18n.js'
import Organisation from '../models/organisation.js'
import User from '../models/user.js'
import { sendMail } from './mail.js'
import { sendPushNotification } from './push.js'

export async function sendNotification(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple | Advance, textState?: string) {
  let recipients = []
  let reportType: ReportType
  if (reportIsTravel(report)) {
    reportType = 'travel'
  } else if (reportIsAdvance(report)) {
    reportType = 'advance'
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
  const userFilter: RootFilterQuery<IUser> = {}
  if (report.state === State.APPLIED_FOR) {
    userFilter[`access.approve/${reportType}`] = true
    Object.assign(userFilter, supervisedProjectsFilter)
    button.link = `${process.env.VITE_FRONTEND_URL}/approve/${reportType}/${report._id}`
  } else if (report.state === State.IN_REVIEW) {
    userFilter[`access.examine/${reportType}`] = true
    Object.assign(userFilter, supervisedProjectsFilter)
    button.link = `${process.env.VITE_FRONTEND_URL}/examine/${reportType}/${report._id}`
  } else {
    // 'REJECTED', 'APPROVED', 'REVIEW_COMPLETED', 'IN_REVIEW_BY_INSURANCE'
    userFilter._id = report.owner._id
    button.link =
      report.state === State.REJECTED
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
    if (comment.toState === report.state) {
      interpolation.comment = comment.text
      interpolation.commentator = comment.author.name.givenName
    }
  }

  const subject = i18n.t(`mail.${reportType}.${textState || report.state}.subject`, interpolation)
  const paragraph = i18n.t(`mail.${reportType}.${textState || report.state}.paragraph`, interpolation)
  const lastParagraph = interpolation.comment ? i18n.t(`mail.${reportType}.${textState || report.state}.lastParagraph`, interpolation) : ''
  button.text = i18n.t('labels.viewX', { lng: language, X: i18n.t(`labels.${reportType}`, { lng: language }) })
  sendPushNotification(subject, paragraph, recipients, button.link)
  sendMail(recipients, subject, paragraph, button, lastParagraph)
}

export async function sendA1Notification(report: TravelSimple) {
  const org = await Organisation.findOne({ _id: report.project.organisation })
  if (org?.a1CertificateEmail) {
    const language = (await getDisplaySettings()).locale.default
    const dif = getDiffInDays(report.startDate, report.endDate) + 1
    const t = (key: string) => i18n.t(key, { lng: language })
    const subject = t('mail.travel.a1.subject')
    const paragraph = t('mail.travel.a1.paragraph')
    const lastParagraph = [
      `${t('labels.traveler')}: ${report.owner.name.givenName} ${report.owner.name.familyName}`,
      `${t('labels.reason')}: ${report.reason}`,
      `${t('labels.startDate')}: ${formatter.date(report.startDate, language)}`,
      `${t('labels.endDate')}: ${formatter.date(report.endDate)} (${dif} ${t(`labels.${dif === 1 ? 'day' : 'days'}`)})`,
      `${t('labels.destinationPlace')}: ${PlaceToString(report.destinationPlace, language)}`,
      `${t('labels.approvedBy')}: ${report.editor.name.givenName} ${report.editor.name.familyName}`,
      `${t('labels.destinationName')}: ${report.a1Certificate?.destinationName}`,
      `${t('labels.exactAddress')}: ${report.a1Certificate?.exactAddress}`
    ]
    if (report.fellowTravelersNames) {
      lastParagraph.splice(1, 0, `\n${t('labels.fellowTravelersNames')}: ${report.fellowTravelersNames}`)
    }
    sendMail(
      [{ email: org.a1CertificateEmail, fk: {}, settings: { language }, name: { givenName: org.name, familyName: '' } }],
      subject,
      paragraph,
      undefined,
      lastParagraph,
      false
    )
  }
}
