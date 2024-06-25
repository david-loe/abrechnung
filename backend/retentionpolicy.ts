import {
  AnyState,
  ExpenseReport as IExpenseReport,
  HealthCareCost as IHealthCareCost,
  Travel as ITravel,
  User as IUser,
  ReportType
} from '../common/types.js'
import { sendMail } from './mail/mail.js'
import ExpenseReport from './models/expenseReport.js'
import HealthCareCost from './models/healthCareCost.js'
import Settings from './models/settings.js'
import Travel from './models/travel.js'
import User from './models/user.js'

// deletes travels, expense reports and helth car costs refunded before $days
// set days to -1 for no automaic deletion
async function deleteOld(days: number) {
  if (days != -1) {
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)
    dateThreshold.setHours(0, 0, 0, 0)
    try {
      let result = await Travel.deleteMany({ state: 'refunded', updatedAt: { $lt: dateThreshold } })
      console.log(`Deleted ${result.deletedCount} travels older than ${days} days`)
      result = await ExpenseReport.deleteMany({ state: 'refunded', updatedAt: { $lt: dateThreshold } })
      console.log(`Deleted ${result.deletedCount} expense reports older than ${days} days`)
      result = await HealthCareCost.deleteMany({ state: 'refunded', updatedAt: { $lt: dateThreshold } })
      console.log(`Deleted ${result.deletedCount} health care reports older than ${days} days`)
    } catch (error) {
      console.error('Error deleting during deletion: ', error)
    }
  }
}

//deletes approved travel if they have not been updated since $days
// set days to -1 for no automaic deletion
async function deleteApprovedTravel(days: number) {
  if (days != -1) {
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)
    dateThreshold.setHours(0, 0, 0, 0)
    try {
      const result = await Travel.deleteMany({ state: 'approved', updatedAt: { $lt: dateThreshold } })
      console.log(`Deleted ${result.deletedCount} travels not updated for ${days} days`)
    } catch (error) {
      console.error('Error deleting travels:', error)
    }
  }
}

//deletes 'inWork' expense and  health care cost reports if they have not been updated since $days
// set days to -1 for no automaic deletion
async function deleteUnusedReport(days: number) {
  if (days != -1) {
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)
    dateThreshold.setHours(0, 0, 0, 0)
    try {
      let result = await ExpenseReport.deleteMany({ state: 'inWork', updatedAt: { $lt: dateThreshold } })
      console.log(`Deleted ${result.deletedCount} expense reports not updated for ${days} days`)
      result = await HealthCareCost.deleteMany({ state: 'inWork', updatedAt: { $lt: dateThreshold } })
      console.log(`Deleted ${result.deletedCount} health care reports not updated for ${days} days`)
    } catch (error) {
      console.error('Error deleting expense reports:', error)
    }
  }
}

async function notificationMailForDeletions(
  daysUntilDeletion: number,
  deletionPeriodRefunded: number,
  deletionPeriodApprovedTravel: number,
  deletionPeriodInWorkReport: number
) {
  if (daysUntilDeletion != -1) {
    try {
      await getReportsAndSendNotification('travel', 'approved', deletionPeriodApprovedTravel, daysUntilDeletion)
      await getReportsAndSendNotification('expenseReport', 'inWork', deletionPeriodInWorkReport, daysUntilDeletion)
      await getReportsAndSendNotification('healthCareCost', 'inWork', deletionPeriodInWorkReport, daysUntilDeletion)
      await getReportsAndSendNotification('travel', 'refunded', deletionPeriodRefunded, daysUntilDeletion)
      await getReportsAndSendNotification('expenseReport', 'refunded', deletionPeriodRefunded, daysUntilDeletion)
      await getReportsAndSendNotification('healthCareCost', 'refunded', deletionPeriodRefunded, daysUntilDeletion)
    } catch (error) {
      console.log('Error during sending of notification mails:', error)
    }
  } else {
    console.log('Warning: setting for notification mails before deletion is set to infinite.')
  }
}

async function getReportsAndSendNotification(schema: ReportType, state: AnyState, deletionPeriod: number, daysUntilDeletion: number) {
  let reports: Array<ITravel | IExpenseReport | IHealthCareCost> | undefined
  reports = await getReportsForNotifikationMail(schema, state, deletionPeriod - daysUntilDeletion)
  if (reports) {
    if (reports.length != 0) {
      for (let i = 0; i < reports.length; i++) {
        sendNotificationMails(reports[i], daysUntilDeletion)
        console.log(`send notification for ${schema} with ID: ${reports[i]._id} - will be deleted in ${daysUntilDeletion} days`)
      }
    }
  }
}

async function getReportsForNotifikationMail(schema: String, state: String, days: number) {
  const date = new Date()
  let result: Array<ITravel | IExpenseReport | IHealthCareCost> = []
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  if (schema === 'travel') {
    result = await Travel.find({ state: state, updatedAt: { $lt: date } }).lean()
    if (result) {
      return result
    }
  } else if (schema === 'expenseReport') {
    result = await ExpenseReport.find({ state: state, updatedAt: { $lt: date } }).lean()
    if (result) {
      return result
    }
  } else if (schema === 'healthCareCost') {
    result = await HealthCareCost.find({ state: state, updatedAt: { $lt: date } }).lean()
    if (result) {
      return result
    }
  }
}

async function sendNotificationMails(report: ITravel | IExpenseReport | IHealthCareCost, daysUntilDeletion: number) {
  if (report) {
    let owner
    try {
      owner = await User.findOne({ _id: report.owner._id })
    } catch (err) {
      console.log(err)
    }
    // missing a little bit logic for creating link an etc.
    // needing $t locales for creating the template correctly
    if (owner) {
      let recipients: Array<IUser> = [owner as IUser]
      let subject = 'Deletion Warning'
      let paragaph = `Hinweis: Ihr Report ${report.name} wird in ${daysUntilDeletion} gelöscht. Laden Sie noch ihren Bericht herunter.`
      let button = { text: 'Hier gehts zum Report', link: 'xyz' }
      let lastParagraph = 'Tschau Tschüss'
      sendMail(recipients, subject, paragaph, button, lastParagraph)
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
      await deleteOld(settings.retentionPolicy.deleteRefundedAfterXDays)
      await deleteApprovedTravel(settings.retentionPolicy.deleteApprovedTravelAfterXDaysUnused)
      await deleteUnusedReport(settings.retentionPolicy.deleteInWorkReportsAfterXDaysUnused)
    } catch (error) {
      console.log('Error in retention policy:', error)
    }
  } else {
    console.error('Settings not found!')
  }
}
