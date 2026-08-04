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
} from 'abrechnung-common/types.js'
import { mdLinksToHtml } from 'abrechnung-common/utils/scripts.js'
import escapeHtml from 'escape-html'
import { mongo, QueryFilter, Types } from 'mongoose'
import ENV from '../../env.js'
import { genAuthenticatedLink } from '../../helper.js'
import i18n from '../../i18n.js'
import User from '../../models/user.js'
import { type IntegrationEventHandlerMap } from '../events.js'
import { Integration } from '../integration.js'
import { enqueueMail } from './email.js'
import { enqueuePushNotification } from './push.js'
import { getOwnerReportRoute } from './statusLinks.js'

class StatusNotificationIntegration extends Integration {
  override readonly events: Partial<IntegrationEventHandlerMap> = {
    'report.submitted': async ({ report }) => await sendStatusNotification(report),
    'report.review_requested': async ({ report }) => await sendStatusNotification(report),
    'report.rejected': async ({ report }) => await sendStatusNotification(report),
    'report.approval_withdrawn': async ({ report }) => await sendStatusNotification(report, 'APPROVAL_WITHDRAWN', true),
    'report.back_to_in_work': async ({ report }) => await sendStatusNotification(report, 'BACK_TO_IN_WORK'),
    'report.review_completed': async ({ report }) => await sendStatusNotification(report),
    'travel.approved': async ({ report }) => await sendStatusNotification(report),
    'travel.back_to_approved': async ({ report }) => await sendStatusNotification(report, 'BACK_TO_APPROVED'),
    'advance.deleted': async ({ report, deletedBy }) => await sendStatusNotification(report, 'DELETED', true, deletedBy)
  }

  public constructor() {
    super('notifications.status')
  }
}

export const statusNotificationIntegration = new StatusNotificationIntegration()

export async function sendStatusNotification(
  report: TravelSimple | ExpenseReportSimple | HealthCareCostSimple | Advance,
  textState?: string,
  notifyOwner = false,
  deletedBy?: string
) {
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
  const userFilter: QueryFilter<IUser<Types.ObjectId, mongo.Binary>> = {}

  if (notifyOwner) {
    userFilter._id = report.owner._id
    button.link =
      textState === 'DELETED'
        ? `${ENV.VITE_FRONTEND_URL}/${reportType}`
        : `${ENV.VITE_FRONTEND_URL}${getOwnerReportRoute(reportType, report._id, report.state)}`
  } else if (report.state === State.APPLIED_FOR) {
    userFilter[`access.approve/${reportType}`] = true
    Object.assign(userFilter, supervisedProjectsFilter)
    button.link = `${ENV.VITE_FRONTEND_URL}/approve/${reportType}/${report._id}`
  } else if (report.state === State.IN_REVIEW) {
    userFilter[`access.examine/${reportType}`] = true
    Object.assign(userFilter, supervisedProjectsFilter)
    button.link = `${ENV.VITE_FRONTEND_URL}/examine/${reportType}/${report._id}`
  } else {
    userFilter._id = report.owner._id
    button.link = `${ENV.VITE_FRONTEND_URL}${getOwnerReportRoute(reportType, report._id, report.state)}`
  }

  recipients = await User.find(userFilter).lean()
  if (recipients.length === 0) {
    return
  }

  const language = recipients[0].settings.language
  const interpolation: {
    owner: string
    lng: Locale
    comment?: string
    commentator?: string
    deletedBy?: string
    project: string
    reportName: string
  } = {
    deletedBy,
    owner: report.owner.name.givenName,
    lng: language,
    project: `${report.project.identifier}${report.project.name ? ` ${report.project.name}` : ''}`,
    reportName: report.name
  }

  if (report.comments.length > 0) {
    const comment = report.comments[report.comments.length - 1]
    if (comment.toState === report.state) {
      interpolation.comment = escapeHtml(comment.text)
      interpolation.commentator = comment.author.name.givenName
    }
  }

  const subject = i18n.t(`mail.${reportType}.${stateLabel}.subject`, interpolation)
  const paragraph = i18n.t(`mail.${reportType}.${stateLabel}.paragraph`, interpolation)
  let lastParagraph: string | string[] | undefined = interpolation.comment
    ? i18n.t(`mail.${reportType}.${stateLabel}.lastParagraph`, interpolation)
    : undefined

  if (reportIsAdvance(report) && stateLabel === AdvanceState[AdvanceState.APPROVED]) {
    const confirmRoute = `/advance/${report._id}/confirm`
    let confirmLink = `${ENV.VITE_FRONTEND_URL}${confirmRoute}`
    if (recipients.length === 1 && recipients[0].fk.magiclogin) {
      try {
        confirmLink = await genAuthenticatedLink({ destination: recipients[0].fk.magiclogin, redirect: confirmRoute })
      } catch (_error) {}
    }

    const confirmLine = mdLinksToHtml(i18n.t('mail.advance.APPROVED.confirmationLine', { ...interpolation, confirmLink }))
    lastParagraph = interpolation.comment ? [lastParagraph as string, confirmLine] : confirmLine
  }

  button.text = i18n.t('labels.viewX', { lng: language, X: i18n.t(`labels.${reportType}`, { lng: language }) })
  await enqueuePushNotification(subject, paragraph, recipients, button.link)
  await enqueueMail(recipients, subject, paragraph, button, lastParagraph)
}
