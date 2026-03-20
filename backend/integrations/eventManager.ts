import { sendViaMail, writeToDiskFilePath } from '../pdf/helper.js'
import {
  emitIntegrationEvent as emitIntegrationEventWithIntegrations,
  type IntegrationEvent,
  type RegisteredIntegration
} from './events.js'
import { sendA1Notification, sendNotification } from './notifications/notification.js'
import { writeReportToDisk } from './reportDelivery/saveReportOnDisk.js'
import type { IntegrationReport } from './types.js'
import { runWebhooks } from './webhooks/execute.js'

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
      const report = event.report as { isCrossBorder: boolean; destinationPlace: { country: { needsA1Certificate: boolean } } }
      if (report.isCrossBorder && report.destinationPlace.country.needsA1Certificate) {
        await sendA1Notification(event.report as never)
      }
    }
  }
]

export async function emitIntegrationEvent(event: IntegrationEvent) {
  await emitIntegrationEventWithIntegrations(event, registeredIntegrations)
}
