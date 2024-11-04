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
import { getSettings } from './db.js'
import i18n from './i18n.js'
import { sendMail } from './mail/mail.js'
import User from './models/user.js'

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
    }
  }
}

async function deleteAny(reports: Array<ITravel | IExpenseReport | IHealthCareCost>, schema: schemaNames) {
  let result: any
  for (let i = 0; i < reports.length; i++) {
    result = await model(schema).deleteOne({ _id: reports[i]._id })
    if (result && result.deletedCount == 1) {
      console.log(
        `Deleted ${schema} from owner ${reports[i].owner.name.givenName} ${reports[i].owner.name.familyName} with name ${reports[i].name}.`
      )
    }
  }
}

async function notificationMailForDeletions(retentionPolicy: { [key in RetentionType]: number }) {
  let notifications = await getPolicyElements(retentionPolicy)
  if (retentionPolicy.mailXDaysBeforeDeletion > 0) {
    for (let i = 0; i < notifications.length; i++) {
      if (notifications[i].deletionPeriod != 0) {
        let daysUntilDeletionTemp =
          retentionPolicy.mailXDaysBeforeDeletion < notifications[i].deletionPeriod
            ? retentionPolicy.mailXDaysBeforeDeletion
            : notifications[i].deletionPeriod
        let date = await getDateThreshold(notifications[i].deletionPeriod - daysUntilDeletionTemp)
        let startDate = new Date(date)
        startDate.setDate(startDate.getDate() - 1)
        let result = await getForRetentionPolicy(notifications[i].schema, date, notifications[i].state, startDate)
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
    let owner
    owner = await User.findOne({ _id: report.owner._id }).lean()
    if (owner) {
      let recipients = [owner]

      let reportType: ReportType
      if (reportIsTravel(report)) {
        reportType = 'travel'
      } else if (reportIsHealthCareCost(report)) {
        reportType = 'healthCareCost'
      } else {
        reportType = 'expenseReport'
      }

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

export async function retentionPolicy() {
  const settings = await getSettings()

  await notificationMailForDeletions(settings.retentionPolicy)
  await triggerDeletion(settings.retentionPolicy)
}
