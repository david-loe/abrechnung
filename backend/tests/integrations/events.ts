import test from 'ava'
import { type EventIntegration, emitIntegrationEvent, type IntegrationEvent } from '../../integrations/events.js'

type IntegrationReport = Extract<IntegrationEvent, { type: 'report.submitted' }>['report']
type IntegrationTravelReport = Extract<IntegrationEvent, { type: 'travel.directly_approved' }>['report']

function createReport(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'report-1',
    state: 1,
    owner: { name: { givenName: 'Fry' } },
    comments: [],
    project: {},
    ...overrides
  } as unknown as IntegrationReport
}

function createTravelReport(overrides: Record<string, unknown> = {}) {
  return createReport({
    isCrossBorder: false,
    destinationPlace: { country: { needsA1Certificate: false } },
    ...overrides
  }) as IntegrationTravelReport
}

function createIntegrations() {
  const calls = {
    webhooks: [] as IntegrationReport[],
    notifications: [] as Array<{ report: unknown; textState?: string; notifyOwner?: boolean; deletedBy?: string }>,
    reportMails: [] as IntegrationReport[],
    a1: [] as IntegrationReport[]
  }

  const integrations: EventIntegration[] = [
    {
      events: {
        'report.draft_saved': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        },
        'report.submitted': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        },
        'report.review_requested': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        },
        'report.rejected': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        },
        'report.back_to_in_work': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        },
        'report.review_completed': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        },
        'travel.directly_approved': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        },
        'travel.approved': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        },
        'advance.received': async (event) => {
          calls.webhooks.push(event.report as IntegrationReport)
        }
      }
    },
    {
      events: {
        'report.submitted': async (event) => {
          calls.notifications.push({ report: event.report, textState: undefined })
        },
        'report.review_requested': async (event) => {
          calls.notifications.push({ report: event.report, textState: undefined })
        },
        'report.rejected': async (event) => {
          calls.notifications.push({ report: event.report, textState: undefined })
        },
        'report.approval_withdrawn': async (event) => {
          calls.notifications.push({ report: event.report, textState: 'APPROVAL_WITHDRAWN', notifyOwner: true })
        },
        'report.back_to_in_work': async (event) => {
          calls.notifications.push({ report: event.report, textState: 'BACK_TO_IN_WORK' })
        },
        'report.review_completed': async (event) => {
          calls.notifications.push({ report: event.report, textState: undefined })
        },
        'travel.approved': async (event) => {
          calls.notifications.push({ report: event.report, textState: undefined })
        },
        'travel.back_to_approved': async (event) => {
          calls.notifications.push({ report: event.report, textState: 'BACK_TO_APPROVED' })
        },
        'advance.deleted': async (event) => {
          calls.notifications.push({ report: event.report, textState: 'DELETED', notifyOwner: true, deletedBy: event.deletedBy })
        }
      }
    },
    {
      events: {
        'report.review_completed': async (event) => {
          calls.reportMails.push(event.report as IntegrationReport)
        }
      }
    },
    {
      events: {
        'travel.directly_approved': async (event) => {
          const report = event.report as { isCrossBorder: boolean; destinationPlace: { country: { needsA1Certificate: boolean } } }
          if (report.isCrossBorder && report.destinationPlace.country.needsA1Certificate) {
            calls.a1.push(event.report as IntegrationReport)
          }
        },
        'travel.approved': async (event) => {
          const report = event.report as { isCrossBorder: boolean; destinationPlace: { country: { needsA1Certificate: boolean } } }
          if (report.isCrossBorder && report.destinationPlace.country.needsA1Certificate) {
            calls.a1.push(event.report as IntegrationReport)
          }
        }
      }
    }
  ]

  return { calls, integrations }
}
test('report.submitted fans out to webhooks and notifications only', async (t) => {
  const report = createReport()
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'report.submitted', report }, integrations)

  t.deepEqual(calls.webhooks, [report])
  t.deepEqual(calls.notifications, [{ report, textState: undefined }])
  t.deepEqual(calls.reportMails, [])
  t.deepEqual(calls.a1, [])
})

test('report.review_completed fans out to report outbound integrations', async (t) => {
  const report = createReport()
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'report.review_completed', report }, integrations)

  t.deepEqual(calls.webhooks, [report])
  t.deepEqual(calls.notifications, [{ report, textState: undefined }])
  t.deepEqual(calls.reportMails, [report])
})

test('report.approval_withdrawn only triggers an owner notification', async (t) => {
  const report = createReport()
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'report.approval_withdrawn', report }, integrations)

  t.deepEqual(calls.webhooks, [])
  t.deepEqual(calls.notifications, [{ report, textState: 'APPROVAL_WITHDRAWN', notifyOwner: true }])
  t.deepEqual(calls.reportMails, [])
})

test('advance.deleted only triggers a notification with the deletion state', async (t) => {
  const report = createReport() as Extract<IntegrationEvent, { type: 'advance.deleted' }>['report']
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'advance.deleted', report, deletedBy: 'Bender' }, integrations)

  t.deepEqual(calls.webhooks, [])
  t.deepEqual(calls.notifications, [{ report, textState: 'DELETED', notifyOwner: true, deletedBy: 'Bender' }])
  t.deepEqual(calls.reportMails, [])
})

test('travel.back_to_approved only triggers notification with custom state label', async (t) => {
  const report = createTravelReport()
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'travel.back_to_approved', report }, integrations)

  t.deepEqual(calls.webhooks, [])
  t.deepEqual(calls.notifications, [{ report, textState: 'BACK_TO_APPROVED' }])
  t.deepEqual(calls.reportMails, [])
  t.deepEqual(calls.a1, [])
})

test('travel.directly_approved triggers A1 notification when conditions are met', async (t) => {
  const report = createTravelReport({ isCrossBorder: true, destinationPlace: { country: { needsA1Certificate: true } } })
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'travel.directly_approved', report }, integrations)

  t.deepEqual(calls.webhooks, [report])
  t.deepEqual(calls.notifications, [])
  t.deepEqual(calls.a1, [report])
})

test('travel.directly_approved skips A1 notification when conditions are not met', async (t) => {
  const report = createTravelReport()
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'travel.directly_approved', report }, integrations)

  t.deepEqual(calls.webhooks, [report])
  t.deepEqual(calls.a1, [])
})
