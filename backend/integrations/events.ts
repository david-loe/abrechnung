import { Advance, ExpenseReport, HealthCareCost, Travel } from 'abrechnung-common/types.js'
import { sendViaMail, writeToDiskFilePath } from '../pdf/helper.js'
import { sendA1Notification, sendNotification } from './notifications/notification.js'
import { writeReportToDisk } from './reportDelivery/saveReportOnDisk.js'
import { IntegrationReport } from './types.js'
import { runWebhooks } from './webhooks/execute.js'

type ReportEventTarget = Travel | ExpenseReport | HealthCareCost | Advance

type TravelEventTarget = Travel
type ReviewableReportTarget = ReportEventTarget

export type IntegrationEvent =
  | { type: 'report.draft_saved'; report: ReportEventTarget }
  | { type: 'report.submitted'; report: ReportEventTarget }
  | { type: 'report.review_requested'; report: ReportEventTarget }
  | { type: 'report.rejected'; report: ReportEventTarget }
  | { type: 'report.back_to_in_work'; report: ReportEventTarget }
  | { type: 'report.review_completed'; report: ReviewableReportTarget }
  | { type: 'travel.directly_approved'; report: TravelEventTarget }
  | { type: 'travel.approved'; report: TravelEventTarget }
  | { type: 'travel.back_to_approved'; report: TravelEventTarget }
  | { type: 'advance.received'; report: Advance }

interface RegisteredIntegration {
  handles(event: IntegrationEvent): boolean
  run(event: IntegrationEvent): Promise<void>
}

const registeredIntegrations: RegisteredIntegration[] = [
  {
    handles: (event) =>
      [
        'report.draft_saved',
        'report.submitted',
        'report.review_requested',
        'report.rejected',
        'report.back_to_in_work',
        'report.review_completed',
        'travel.directly_approved',
        'travel.approved',
        'advance.received'
      ].includes(event.type),
    run: async (event) => {
      await runWebhooks(event.report as IntegrationReport)
    }
  },
  {
    handles: (event) =>
      [
        'report.submitted',
        'report.review_requested',
        'report.rejected',
        'report.back_to_in_work',
        'report.review_completed',
        'travel.approved',
        'travel.back_to_approved'
      ].includes(event.type),
    run: async (event) => {
      if (event.type === 'report.back_to_in_work') {
        await sendNotification(event.report as IntegrationReport, 'BACK_TO_IN_WORK')
      } else if (event.type === 'travel.back_to_approved') {
        await sendNotification(event.report as IntegrationReport, 'BACK_TO_APPROVED')
      } else {
        await sendNotification(event.report as IntegrationReport)
      }
    }
  },
  {
    handles: (event) => event.type === 'report.review_completed',
    run: async (event) => {
      await sendViaMail(event.report as IntegrationReport)
    }
  },
  {
    handles: (event) => event.type === 'report.review_completed',
    run: async (event) => {
      const report = event.report as IntegrationReport
      await writeReportToDisk(await writeToDiskFilePath(report), report)
    }
  },
  {
    handles: (event) => ['travel.directly_approved', 'travel.approved'].includes(event.type),
    run: async (event) => {
      const report = event.report as TravelEventTarget
      if (report.isCrossBorder && report.destinationPlace.country.needsA1Certificate) {
        await sendA1Notification(report)
      }
    }
  }
]

export async function emitIntegrationEvent(event: IntegrationEvent) {
  for (const integration of registeredIntegrations) {
    if (integration.handles(event)) {
      await integration.run(event)
    }
  }
}
