import {
  ExpenseReportSimple,
  HealthCareCostSimple,
  Locale,
  ReportType,
  TravelSimple,
  reportIsHealthCareCost,
  reportIsTravel
} from '../../common/types.js'
import i18n, { formatter } from '../i18n.js'
import User from '../models/user.js'
import { sendMail } from './mail.js'
import { sendPushNotification } from './push.js'

export async function sendNotification(report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple, textState?: string) {
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
  sendPushNotification(subject, paragraph, recipients, button.link)
  sendMail(recipients, subject, paragraph, button, lastParagraph)
}
