import {
  AnyState,
  ExpenseReport as IExpenseReport,
  HealthCareCost as IHealthCareCost,
  Travel as ITravel,
  User as IUser,
  Locale,
  ReportType,
  reportIsHealthCareCost,
  reportIsTravel
} from '../common/types.js'
import i18n from './i18n.js'
import { sendMail } from './mail/mail.js'
import ExpenseReport from './models/expenseReport.js'
import HealthCareCost from './models/healthCareCost.js'
import Settings from './models/settings.js'
import Travel from './models/travel.js'
import User from './models/user.js'

async function deleteAny(reports: Array<ITravel | IExpenseReport | IHealthCareCost>, schema: ReportType) {
  let countOldVersions = 0
  let result: any
  for (let i = 0; i < reports.length; i++) {
    console.log(reports[i].history)
    if (schema === 'travel') {
      result = await Travel.deleteMany({ _id: reports[i].history })
      countOldVersions = result.deletedCount
      result = await Travel.deleteOne({ _id: reports[i]._id })
    } else if (schema === 'expenseReport') {
      result = await ExpenseReport.deleteMany({ _id: reports[i].history })
      countOldVersions = result.deletedCount
      result = await ExpenseReport.deleteOne({ _id: reports[i]._id })
    } else if (schema === 'healthCareCost') {
      result = await HealthCareCost.deleteMany({ _id: reports[i].history })
      countOldVersions = result.deletedCount
      result = await HealthCareCost.deleteOne({ _id: reports[i]._id })
    }
    if (result && result.deletedCount == 1) {
      console.log(`Deleted ${schema} with id ${reports[i]._id} including ${countOldVersions} older versions of this ${schema}.`)
    }
  }
}

// deletes travels, expense reports and helth car costs refunded before $days
// set days to -1 for no automaic deletion
async function getRefundedForDeletion(days: number) {
  if (days != -1) {
    let dateThreshold = new Date()
    dateThreshold.setHours(23, 59, 0, 0)

    dateThreshold.setDate(dateThreshold.getDate() - days)
    console.log('datumsschwelle für Löschung: ', dateThreshold)
    try {
      let result = await Travel.find({ state: 'refunded', updatedAt: { $lt: dateThreshold }, historic: false })
      if (result.length > 0) {
        await deleteAny(result, 'travel')
      }
      result = await ExpenseReport.find({ state: 'refunded', updatedAt: { $lt: dateThreshold }, historic: false })
      if (result.length > 0) {
        await deleteAny(result, 'expenseReport')
      }
      result = await HealthCareCost.find({ state: 'refunded', updatedAt: { $lt: dateThreshold }, historic: false })
      if (result.length > 0) {
        await deleteAny(result, 'healthCareCost')
      }
    } catch (error) {
      console.error('Error deleting during deletion: ', error)
    }
  }
}

//deletes approved travel if they have not been updated since $days
// set days to -1 for no automaic deletion
async function getApprovedForDeletion(days: number) {
  if (days != -1) {
    let dateThreshold = new Date()
    dateThreshold.setHours(23, 59, 0, 0)

    dateThreshold.setDate(dateThreshold.getDate() - days)
    console.log('datumsschwelle für Löschung: ', dateThreshold)
    try {
      let result = await Travel.find({ state: 'approved', updatedAt: { $lt: dateThreshold }, historic: false })
      if (result.length > 0) {
        await deleteAny(result, 'travel')
      }
    } catch (error) {
      console.error('Error deleting travels:', error)
    }
  }
}

//gets and deletes 'inWork' expense and  health care cost reports if they have not been updated since $days
// set days to -1 for no automaic deletion
async function getInWorkForDeletion(days: number) {
  if (days != -1) {
    let dateThreshold = new Date()
    dateThreshold.setHours(23, 59, 0, 0)
    dateThreshold.setDate(dateThreshold.getDate() - days)
    console.log('datumsschwelle für Löschung: ', dateThreshold)
    try {
      let result = await ExpenseReport.find({ state: 'inWork', updatedAt: { $lt: dateThreshold }, historic: false })
      if (result.length > 0) {
        await deleteAny(result, 'expenseReport')
      }
      result = await HealthCareCost.find({ state: 'inWork', updatedAt: { $lt: dateThreshold }, historic: false })
      if (result.length > 0) {
        await deleteAny(result, 'healthCareCost')
      }
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
        console.log(reports[i].updatedAt)
        console.log(`send notification for ${schema} with ID: ${reports[i]._id} - will be deleted in ${daysUntilDeletion} days`)
      }
    }
  }
}

async function getReportsForNotifikationMail(schema: String, state: String, days: number) {
  const date = new Date()
  let result: Array<ITravel | IExpenseReport | IHealthCareCost> = []
  date.setDate(date.getDate() - days)
  date.setHours(23, 59, 0, 0)
  console.log('datumsschwelle für Mailversand: ', date)
  if (schema === 'travel') {
    result = await Travel.find({ state: state, updatedAt: { $lt: date }, historic: false }).lean()
    if (result) {
      return result
    }
  } else if (schema === 'expenseReport') {
    result = await ExpenseReport.find({ state: state, updatedAt: { $lt: date }, historic: false }).lean()
    if (result) {
      return result
    }
  } else if (schema === 'healthCareCost') {
    result = await HealthCareCost.find({ state: state, updatedAt: { $lt: date }, historic: false }).lean()
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
      const button = {
        text: '',
        link: ''
      }
      const userFilter: any = {}

      userFilter['_id'] = report.owner._id
      button.link = `${process.env.VITE_FRONTEND_URL}/${reportType}/${report._id}`

      const language = recipients[0].settings.language
      const interpolation: { owner: string; lng: Locale; days: number } = {
        owner: report.owner.name.givenName,
        lng: language,
        days: daysUntilDeletion
      }

      button.text = i18n.t('labels.viewX', { lng: language, X: i18n.t(`labels.${reportType}`, { lng: language }) })

      const subject = i18n.t(`mail.${reportType}.${report.state}DeletedSoon.subject`, interpolation)
      const paragraph = i18n.t(`mail.${reportType}.${report.state}DeletedSoon.paragraph`, interpolation)
      sendMail(recipients, subject, paragraph, button, '')
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
      await getRefundedForDeletion(settings.retentionPolicy.deleteRefundedAfterXDays)
      await getApprovedForDeletion(settings.retentionPolicy.deleteApprovedTravelAfterXDaysUnused)
      await getInWorkForDeletion(settings.retentionPolicy.deleteInWorkReportsAfterXDaysUnused)
    } catch (error) {
      console.log('Error in retention policy:', error)
    }
  } else {
    console.error('Settings not found!')
  }
}
