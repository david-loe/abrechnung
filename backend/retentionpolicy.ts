import { model } from 'mongoose'
import {
  AnyState,
  ExpenseReport as IExpenseReport,
  HealthCareCost as IHealthCareCost,
  Travel as ITravel,
  User as IUser,
  Locale,
  ReportType,
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

async function triggerDeletion(retentionSettings: {
  deleteRefundedAfterXDays: number
  deleteApprovedTravelAfterXDaysUnused: number
  deleteInWorkReportsAfterXDaysUnused: number
}) {
  let deletions: { schema: schemaNames; state: AnyState; deletionPeriod: number }[] = [
    { schema: 'Travel', state: 'refunded', deletionPeriod: retentionSettings.deleteRefundedAfterXDays },
    { schema: 'Travel', state: 'approved', deletionPeriod: retentionSettings.deleteApprovedTravelAfterXDaysUnused },
    { schema: 'ExpenseReport', state: 'refunded', deletionPeriod: retentionSettings.deleteRefundedAfterXDays },
    { schema: 'ExpenseReport', state: 'inWork', deletionPeriod: retentionSettings.deleteInWorkReportsAfterXDaysUnused },
    { schema: 'HealthCareCost', state: 'refunded', deletionPeriod: retentionSettings.deleteRefundedAfterXDays },
    { schema: 'HealthCareCost', state: 'inWork', deletionPeriod: retentionSettings.deleteInWorkReportsAfterXDaysUnused }
  ]
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

async function notificationMailForDeletions(
  daysUntilDeletion: number,
  deletionPeriodRefunded: number,
  deletionPeriodApprovedTravel: number,
  deletionPeriodInWorkReport: number
) {
  let notifications: { schema: schemaNames; state: AnyState; deletionPeriod: number }[] = [
    { schema: 'Travel', state: 'refunded', deletionPeriod: deletionPeriodRefunded },
    { schema: 'Travel', state: 'approved', deletionPeriod: deletionPeriodApprovedTravel },
    { schema: 'ExpenseReport', state: 'refunded', deletionPeriod: deletionPeriodRefunded },
    { schema: 'ExpenseReport', state: 'inWork', deletionPeriod: deletionPeriodInWorkReport },
    { schema: 'HealthCareCost', state: 'refunded', deletionPeriod: deletionPeriodRefunded },
    { schema: 'HealthCareCost', state: 'inWork', deletionPeriod: deletionPeriodInWorkReport }
  ]
  if (daysUntilDeletion > 0) {
    try {
      for (let i = 0; i < notifications.length; i++) {
        let daysUntilDeletionTemp =
          daysUntilDeletion < notifications[i].deletionPeriod ? daysUntilDeletion : notifications[i].deletionPeriod
        console.log(notifications[i].deletionPeriod - daysUntilDeletionTemp)
        let date = await getDateThreshold(notifications[i].deletionPeriod - daysUntilDeletionTemp)
        let result = await getForRetentionPolicy(notifications[i].schema, date, notifications[i].state)
        console.log(
          `searched for ${notifications[i].schema} with state ${notifications[i].state}  - and deletion in ${daysUntilDeletionTemp} or less days`
        )
        if (result.length > 0) {
          for (let p = 0; p < result.length; p++) {
            await sendNotificationMails(result[p], notifications[i].deletionPeriod)
            console.log(`sent notification mail for ${notifications[i].schema} with ID: ${result[p]._id}`)
          }
        }
      }
    } catch (error) {
      console.log('Error during sending of notification mails:', error)
    }
  } else {
    console.log('Warning: setting for notification mails before deletion is set to infinite.')
  }
}

async function sendNotificationMails(report: ITravel | IExpenseReport | IHealthCareCost, deletionPeriod: number) {
  if (report) {
    let owner
    try {
      owner = await User.findOne({ _id: report.owner._id })
    } catch (err) {
      console.log(err)
    }
    if (owner) {
      let recipients: Array<IUser> = [owner as IUser]

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
      console.log(report.updatedAt)
      console.log(date, '  ', today)
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
    try {
      await notificationMailForDeletions(
        settings.retentionPolicy.mailXDaysBeforeDeletion,
        settings.retentionPolicy.deleteRefundedAfterXDays,
        settings.retentionPolicy.deleteApprovedTravelAfterXDaysUnused,
        settings.retentionPolicy.deleteInWorkReportsAfterXDaysUnused
      )
      await triggerDeletion(settings.retentionPolicy)
    } catch (error) {
      console.log('Error in retention policy:', error)
    }
  } else {
    console.error('Settings not found!')
  }
}
