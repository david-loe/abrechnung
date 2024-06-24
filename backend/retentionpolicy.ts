import { ExpenseReport as IExpenseReport, HealthCareCost as IHealthCareCost, Travel as ITravel, User as IUser } from '../common/types.js'
import { sendMail } from './mail/mail.js'
import ExpenseReport from './models/expenseReport.js'
import HealthCareCost from './models/healthCareCost.js'
import Settings from './models/settings.js'
import Travel from './models/travel.js'
import User from './models/user.js'

async function deleteOld(days: number) {
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - days)
  try {
    const result = await Travel.deleteMany({ state: 'refunded', updatedAt: { $lt: dateThreshold } })
    console.log(`Deleted ${result.deletedCount} travels older than ${days} days`)
  } catch (error) {
    console.error('Error deleting travels:', error)
  }
  try {
    const result = await ExpenseReport.deleteMany({ state: 'refunded', updatedAt: { $lt: dateThreshold } })
    console.log(`Deleted ${result.deletedCount} expense reports older than ${days} days`)
  } catch (error) {
    console.error('Error deleting expense reports:', error)
  }
  try {
    const result = await HealthCareCost.deleteMany({ state: 'refunded', updatedAt: { $lt: dateThreshold } })
    console.log(`Deleted ${result.deletedCount} health care reports older than ${days} days`)
  } catch (error) {
    console.error('Error deleting health care reports:', error)
  }
}

async function deleteApprovedTravel(days: number) {
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - days)
  try {
    const result = await Travel.deleteMany({ state: 'approved', updatedAt: { $lt: dateThreshold } })
    console.log(`Deleted ${result.deletedCount} travels not updated for ${days} days`)
  } catch (error) {
    console.error('Error deleting travels:', error)
  }
}

async function deleteUnusedReport(days: number) {
  const dateThreshold = new Date()
  dateThreshold.setDate(dateThreshold.getDate() - days)
  try {
    const result = await ExpenseReport.deleteMany({ state: 'inWork', updatedAt: { $lt: dateThreshold } })
    console.log(`Deleted ${result.deletedCount} expense reports not updated for ${days} days`)
  } catch (error) {
    console.error('Error deleting expense reports:', error)
  }
  try {
    const result = await HealthCareCost.deleteMany({ state: 'inWork', updatedAt: { $lt: dateThreshold } })
    console.log(`Deleted ${result.deletedCount} health care reports not updated for ${days} days`)
  } catch (error) {
    console.error('Error deleting health care reports:', error)
  }
}
async function sendInfoMailForUpcomingDeletion(
  daysUntilDeletion: number,
  deletionPeriodRefunded: number,
  deletionPeriodApprovedTravel: number,
  deletionPeriodInWorkReport: number
) {
  let reports: Array<ITravel | IExpenseReport | IHealthCareCost | undefined> | undefined
  reports = await getReportsForNotifikationMail('travel', 'approved', deletionPeriodApprovedTravel - daysUntilDeletion)
  if (reports) {
    if (reports.length != 0) {
      console.log(reports)
      for (let i = 0; i < reports.length; i++) {
        sendNotificationMails(reports[i], daysUntilDeletion)
      }
    }
  }
  reports = await getReportsForNotifikationMail('expenseReport', 'inWork', deletionPeriodInWorkReport - daysUntilDeletion)
  if (reports) {
    if (reports.length != 0) {
      console.log(reports)
      for (let i = 0; i < reports.length; i++) {
        sendNotificationMails(reports[i], daysUntilDeletion)
      }
    }
  }
  reports = await getReportsForNotifikationMail('healthCareCost', 'inWork', deletionPeriodInWorkReport - daysUntilDeletion)
  if (reports) {
    if (reports.length != 0) {
      console.log(reports)
      for (let i = 0; i < reports.length; i++) {
        sendNotificationMails(reports[i], daysUntilDeletion)
      }
    }
  }
  reports = await getReportsForNotifikationMail('all', 'refunded', deletionPeriodRefunded - daysUntilDeletion)
  if (reports) {
    if (reports.length != 0) {
      console.log(reports)
      for (let i = 0; i < reports.length; i++) {
        sendNotificationMails(reports[i], daysUntilDeletion)
      }
    }
  }
}

async function getReportsForNotifikationMail(schema: String, state: String, days: number) {
  const date = new Date()
  let result: Array<ITravel | IExpenseReport | IHealthCareCost | undefined>
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  if (state === 'refunded') {
    let travels = (await Travel.find({ state: state, updatedAt: { $lt: date } })) as Array<ITravel>
    let expensereports = await ExpenseReport.find({ state: state, updatedAt: { $lt: date } })
    let healthcarecosts = await HealthCareCost.find({ state: state, updatedAt: { $lt: date } })
    // result.push(travels) - need to fix this here.
    return []
  } else {
    if (schema === 'travel') {
      console.log('Reisen:')
      result = await Travel.find({ state: state, updatedAt: { $lt: date } }).lean()
      return result
    } else if (schema === 'expenseReport') {
      console.log('Auslagen: ')
      result = await ExpenseReport.find({ state: state, updatedAt: { $lt: date } }).lean()
      return result
    } else if (schema === 'healthCareCost') {
      console.log('Krankheitskosten:')
      result = await HealthCareCost.find({ state: state, updatedAt: { $lt: date } }).lean()
      return result
    }
  }
}

async function sendNotificationMails(report: ITravel | IExpenseReport | IHealthCareCost | undefined, daysUntilDeletion: number) {
  console.log('sending mails.')
  if (report) {
    let owner
    try {
      owner = await User.findOne({ _id: report.owner._id })
    } catch (err) {
      console.log(err)
    }
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
    await sendInfoMailForUpcomingDeletion(
      settings.retentionPolicy.mailXDaysBeforeDeletion,
      settings.retentionPolicy.deleteRefundedAfterXDays,
      settings.retentionPolicy.deleteApprovedTravelAfterXDaysUnused,
      settings.retentionPolicy.deleteInWorkReportsAfterXDaysUnused
    )
    await deleteOld(settings.retentionPolicy.deleteRefundedAfterXDays)
    await deleteApprovedTravel(settings.retentionPolicy.deleteApprovedTravelAfterXDaysUnused)
    await deleteUnusedReport(settings.retentionPolicy.deleteInWorkReportsAfterXDaysUnused)
  } else {
    console.error('Settings not found!')
  }
}
