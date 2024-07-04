import { model } from 'mongoose'
import {
  AnyState,
  ExpenseReport as IExpenseReport,
  HealthCareCost as IHealthCareCost,
  Travel as ITravel,
  Locale,
  ReportType,
  RetentionType,
  reportIsHealthCareCost,
  reportIsTravel,
  schemaNames
} from '../common/types.js'
import i18n from './i18n.js'
import { sendMail } from './mail/mail.js'
import Settings from './models/settings.js'
import User from './models/user.js'

async function getForRetentionPolicy(schema: schemaNames, date: Date, state: AnyState) {
  return await model(schema).find({ state: state, updatedAt: { $lt: date }, historic: false })
}

function getDateThreshold(days: number) {
  let dateThreshold = new Date()
  dateThreshold.setHours(0, 0, 0, 0)
  dateThreshold.setDate(dateThreshold.getDate() - days)
  return dateThreshold
}
async function getPolicyElements(retentionPolicy: { [key in RetentionType]: number }) {
  const elements: { schema: schemaNames; state: AnyState; deletionPeriod: number }[] = [
    { schema: 'Travel', state: 'refunded', deletionPeriod: retentionPolicy.deleteRefundedAfterXDays },
    { schema: 'Travel', state: 'approved', deletionPeriod: retentionPolicy.deleteApprovedTravelAfterXDaysUnused },
    { schema: 'ExpenseReport', state: 'refunded', deletionPeriod: retentionPolicy.deleteRefundedAfterXDays },
    { schema: 'ExpenseReport', state: 'inWork', deletionPeriod: retentionPolicy.deleteInWorkReportsAfterXDaysUnused },
    { schema: 'HealthCareCost', state: 'refunded', deletionPeriod: retentionPolicy.deleteRefundedAfterXDays },
    { schema: 'HealthCareCost', state: 'inWork', deletionPeriod: retentionPolicy.deleteInWorkReportsAfterXDaysUnused }
  ]
  return elements
}

async function triggerDeletion(retentionPolicy: { [key in RetentionType]: number }) {
  let deletions = await getPolicyElements(retentionPolicy)
  for (let i = 0; i < deletions.length; i++) {
    if (deletions[i].deletionPeriod > 0) {
      let date = getDateThreshold(deletions[i].deletionPeriod)
      let result = await getForRetentionPolicy(deletions[i].schema, date, deletions[i].state)
      if (result.length > 0) {
        await deleteAny(result, deletions[i].schema)
      }
      console.log(`Triggered deletion of ${deletions[i].state} ${deletions[i].schema} older than the ${deletions[i].deletionPeriod} days.`)
    }
  }
}

async function deleteAny(reports: Array<ITravel | IExpenseReport | IHealthCareCost>, schema: schemaNames) {
  let result: any
  for (let i = 0; i < reports.length; i++) {
    result = await model(schema).deleteOne({ _id: reports[i]._id })
    if (result && result.deletedCount == 1) {
      console.log(`Deleted ${schema} with id ${reports[i]._id} including ${reports[i].history.length} older versions of this ${schema}.`)
    }
  }
}

async function notificationMailForDeletions(retentionPolicy: { [key in RetentionType]: number }) {
  let notifications = await getPolicyElements(retentionPolicy)
  if (retentionPolicy.mailXDaysBeforeDeletion > 0) {
    for (let i = 0; i < notifications.length; i++) {
      let daysUntilDeletionTemp =
        retentionPolicy.mailXDaysBeforeDeletion < notifications[i].deletionPeriod
          ? retentionPolicy.mailXDaysBeforeDeletion
          : notifications[i].deletionPeriod
      let date = await getDateThreshold(notifications[i].deletionPeriod - daysUntilDeletionTemp)
      let result = await getForRetentionPolicy(notifications[i].schema, date, notifications[i].state)
      if (result.length > 0) {
        for (let p = 0; p < result.length; p++) {
          await sendNotificationMails(result[p], notifications[i].deletionPeriod)
        }
      }
    }
  }
}

async function sendNotificationMails(report: ITravel | IExpenseReport | IHealthCareCost, deletionPeriod: number) {
  if (report) {
    let owner
    owner = await User.findOne({ _id: report.owner._id }).lean()
    if (owner) {
      let recipients = [owner]

      var reportType: ReportType
      if (reportIsTravel(report)) {
        reportType = 'travel'
      } else if (reportIsHealthCareCost(report)) {
        reportType = 'healthCareCost'
      } else {
        reportType = 'expenseReport'
      }
      //get days until deletion depending on the deletion Period.
      let date = new Date(report.updatedAt)
      date.setDate(date.getDate() + deletionPeriod)
      date.setHours(0, 0, 0, 0)
      let today = new Date()
      today.setHours(0, 0, 0, 0)
      let differenceInTime = date.getTime() - today.getTime()
      let daysUntilDeletion = differenceInTime / (1000 * 3600 * 24)

      const language = recipients[0].settings.language

      const interpolation: { owner: string; lng: Locale; days: number; reportName: string } = {
        owner: report.owner.name.givenName,
        lng: language,
        days: daysUntilDeletion,
        reportName: report.name
      }

      const button = {
        text: '',
        link: ''
      }

      button.link = `${process.env.VITE_FRONTEND_URL}/${reportType}/${report._id}`

      button.text = i18n.t('labels.viewX', { lng: language, X: i18n.t(`labels.${reportType}`, { lng: language }) })

      const subject = i18n.t(`mail.${reportType}.${report.state}DeletedSoon.subject`, interpolation)
      const paragraph = i18n.t(`mail.${reportType}.${report.state}DeletedSoon.paragraph`, interpolation)
      await sendMail(recipients, subject, paragraph, button, '')
    }
  }
}
async function getSettings() {
  return await Settings.findOne({}).lean()
}

export async function retentionPolicy() {
  const settings = await getSettings()
  if (settings) {
    await notificationMailForDeletions(settings.retentionPolicy)
    await triggerDeletion(settings.retentionPolicy)
  } else {
    console.error('Settings not found!')
  }
}
