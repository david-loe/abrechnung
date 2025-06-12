import { RootFilterQuery } from 'mongoose'
import { getDiffInDays, PlaceToString } from '../../common/scripts.js'
import {
  Advance,
  AdvanceState,
  ExpenseReportSimple,
  ExpenseReportState,
  HealthCareCostSimple,
  HealthCareCostState,
  User as IUser,
  Locale,
  ReportType,
  reportIsAdvance,
  reportIsHealthCareCost,
  reportIsTravel,
  State,
  TravelSimple,
  TravelState
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
  let stateLabel: string
  if (reportIsTravel(report)) {
    reportType = 'travel'
    stateLabel = textState || TravelState[report.state]
  } else if (reportIsAdvance(report)) {
    reportType = 'advance'
    stateLabel = textState || AdvanceState[report.state]
  } else if (reportIsHealthCareCost(report)) {
    reportType = 'healthCareCost'
    stateLabel = textState || HealthCareCostState[report.state]
  } else {
    reportType = 'expenseReport'
    stateLabel = textState || ExpenseReportState[report.state]
  }
  const button = { text: '', link: '' }

  const supervisedProjectsFilter = { $or: [{ 'projects.supervised': [] }, { 'projects.supervised': report.project._id }] }
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
    // 'REJECTED', 'APPROVED', 'REVIEW_COMPLETED'
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

  const interpolation: { owner: string; lng: Locale; comment?: string; commentator?: string } = {
    owner: report.owner.name.givenName,
    lng: language
  }

  if (report.comments.length > 0) {
    const comment = report.comments[report.comments.length - 1]
    if (comment.toState === report.state) {
      interpolation.comment = comment.text
      interpolation.commentator = comment.author.name.givenName
    }
  }

  const subject = i18n.t(`mail.${reportType}.${stateLabel}.subject`, interpolation)
  const paragraph = i18n.t(`mail.${reportType}.${stateLabel}.paragraph`, interpolation)
  const lastParagraph = interpolation.comment ? i18n.t(`mail.${reportType}.${stateLabel}.lastParagraph`, interpolation) : ''
  button.text = i18n.t('labels.viewX', { lng: language, X: i18n.t(`labels.${reportType}`, { lng: language }) })
  sendPushNotification(subject, paragraph, recipients, button.link)
  sendMail(recipients, subject, paragraph, button, lastParagraph)
}

export async function sendA1Notification(report: TravelSimple) {
  const org = await Organisation.findOne({ _id: report.project.organisation })
  if (org?.a1CertificateEmail) {
    const displaySettings = await getDisplaySettings()
    const language = displaySettings.locale.default
    const dif = getDiffInDays(report.startDate, report.endDate) + 1
    const t = (key: string) => i18n.t(key, { lng: language })
    const subject = t('mail.travel.a1.subject')
    const paragraph = t('mail.travel.a1.paragraph')
    const lastParagraph = [
      `${t('labels.traveler')}: ${formatter.name(report.owner.name)}`,
      `${t('labels.reason')}: ${report.reason}`,
      `${t('labels.startDate')}: ${formatter.date(report.startDate, language)}`,
      `${t('labels.endDate')}: ${formatter.date(report.endDate, language)} (${dif} ${t(`labels.${dif === 1 ? 'day' : 'days'}`)})`,
      `${t('labels.destinationPlace')}: ${PlaceToString(report.destinationPlace, language)}`,
      `${t('labels.approvedBy')}: ${formatter.name(report.editor.name)}`,
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
