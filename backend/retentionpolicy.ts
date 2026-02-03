import {
  AnyState,
  ExpenseReportState,
  HealthCareCostState,
  ExpenseReport as IExpenseReport,
  HealthCareCost as IHealthCareCost,
  Travel as ITravel,
  Locale,
  ReportType,
  RetentionType,
  reportIsHealthCareCost,
  reportIsTravel,
  State,
  schemaNames,
  TravelState
} from 'abrechnung-common/types.js'
import { model } from 'mongoose'
import { getSettings } from './db.js'
import ENV from './env.js'
import { formatter } from './factory.js'
import i18n from './i18n.js'
import { logger } from './logger.js'
import User from './models/user.js'
import { enqueueMail } from './notifications/mail.js'

async function getForRetentionPolicy(schema: schemaNames, date: Date, state: AnyState, startDate?: Date) {
  let res: Array<ITravel | IExpenseReport | IHealthCareCost>
  if (startDate) {
    res = await model<ITravel | IExpenseReport | IHealthCareCost>(schema)
      .find({ state: state, updatedAt: { $gte: startDate, $lt: date }, historic: false })
      .lean()
  } else {
    res = await model<ITravel | IExpenseReport | IHealthCareCost>(schema)
      .find({ state: state, updatedAt: { $lt: date }, historic: false })
      .lean()
  }

  return res
}

function getDateThreshold(days: number) {
  const dateThreshold = new Date()
  dateThreshold.setHours(0, 0, 0, 0)
  dateThreshold.setDate(dateThreshold.getDate() - days)
  return dateThreshold
}

async function getPolicyElements(retentionPolicy: { [key in RetentionType]: number }) {
  const elements: { schema: schemaNames; state: AnyState; deletionPeriod: number }[] = [
    { schema: 'Travel', state: State.BOOKED, deletionPeriod: retentionPolicy.deleteBookedAfterXDays },
    { schema: 'Travel', state: State.EDITABLE_BY_OWNER, deletionPeriod: retentionPolicy.deleteApprovedTravelAfterXDaysUnused },
    { schema: 'ExpenseReport', state: State.BOOKED, deletionPeriod: retentionPolicy.deleteBookedAfterXDays },
    { schema: 'ExpenseReport', state: State.EDITABLE_BY_OWNER, deletionPeriod: retentionPolicy.deleteInWorkReportsAfterXDaysUnused },
    { schema: 'HealthCareCost', state: State.BOOKED, deletionPeriod: retentionPolicy.deleteBookedAfterXDays },
    { schema: 'HealthCareCost', state: State.EDITABLE_BY_OWNER, deletionPeriod: retentionPolicy.deleteInWorkReportsAfterXDaysUnused }
  ]
  return elements
}

async function triggerDeletion(retentionPolicy: { [key in RetentionType]: number }) {
  const deletions = await getPolicyElements(retentionPolicy)
  for (let i = 0; i < deletions.length; i++) {
    if (deletions[i].deletionPeriod > 0) {
      const date = getDateThreshold(deletions[i].deletionPeriod)
      const result = await getForRetentionPolicy(deletions[i].schema, date, deletions[i].state)
      if (result.length > 0) {
        await deleteAny(result, deletions[i].schema)
      }
    }
  }
}

async function deleteAny(reports: Array<ITravel | IExpenseReport | IHealthCareCost>, schema: schemaNames) {
  for (let i = 0; i < reports.length; i++) {
    const result = await model(schema).deleteOne({ _id: reports[i]._id })
    if (result && result.deletedCount === 1) {
      logger.info(`Deleted ${schema} from owner ${formatter.name(reports[i].owner.name)} with name ${reports[i].name}.`)
    }
  }
}

async function notificationMailForDeletions(retentionPolicy: { [key in RetentionType]: number }) {
  const notifications = await getPolicyElements(retentionPolicy)
  if (retentionPolicy.mailXDaysBeforeDeletion > 0) {
    for (let i = 0; i < notifications.length; i++) {
      if (notifications[i].deletionPeriod !== 0) {
        const daysUntilDeletionTemp =
          retentionPolicy.mailXDaysBeforeDeletion < notifications[i].deletionPeriod
            ? retentionPolicy.mailXDaysBeforeDeletion
            : notifications[i].deletionPeriod
        const date = await getDateThreshold(notifications[i].deletionPeriod - daysUntilDeletionTemp)
        const startDate = new Date(date)
        startDate.setDate(startDate.getDate() - 1)
        const result = await getForRetentionPolicy(notifications[i].schema, date, notifications[i].state, startDate)
        if (result.length > 0) {
          for (let p = 0; p < result.length; p++) {
            await sendNotificationMails(result[p], daysUntilDeletionTemp)
          }
        }
      }
    }
  }
}

async function sendNotificationMails(report: ITravel | IExpenseReport | IHealthCareCost, daysUntilDeletion: number) {
  if (report) {
    const owner = await User.findOne({ _id: report.owner._id }).lean()
    if (owner) {
      const recipients = [owner]

      let reportType: ReportType
      let stateLabel: string
      if (reportIsTravel(report)) {
        reportType = 'travel'
        stateLabel = TravelState[report.state]
      } else if (reportIsHealthCareCost(report)) {
        reportType = 'healthCareCost'
        stateLabel = HealthCareCostState[report.state]
      } else {
        reportType = 'expenseReport'
        stateLabel = ExpenseReportState[report.state]
      }

      const language = recipients[0].settings.language

      const interpolation: { owner: string; lng: Locale; days: number; reportName: string } = {
        owner: report.owner.name.givenName,
        lng: language,
        days: daysUntilDeletion,
        reportName: report.name
      }

      const button = { text: '', link: '' }

      button.link = `${ENV.VITE_FRONTEND_URL}/${reportType}/${report._id}`

      button.text = i18n.t('labels.viewX', { lng: language, X: i18n.t(`labels.${reportType}`, { lng: language }) })

      const subject = i18n.t(`mail.${reportType}.${stateLabel}_getsDeletedSoon.subject`, interpolation)
      const paragraph = i18n.t(`mail.${reportType}.${stateLabel}_getsDeletedSoon.paragraph`, interpolation)
      await enqueueMail(recipients, subject, paragraph, button)
    }
  }
}

export async function retentionPolicy() {
  // NO BACKEND_CACHE bc only queried once a day
  const settings = await getSettings()

  await notificationMailForDeletions(settings.retentionPolicy)
  await triggerDeletion(settings.retentionPolicy)
}
