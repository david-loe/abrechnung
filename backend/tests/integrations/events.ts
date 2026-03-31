import test from 'ava'
import { type EventIntegration, emitIntegrationEvent } from '../../integrations/events.js'
import { type IntegrationReport } from '../../integrations/types.js'

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
  return createReport({ isCrossBorder: false, destinationPlace: { country: { needsA1Certificate: false } }, ...overrides })
}

function createIntegrations() {
  const calls = {
    webhooks: [] as IntegrationReport[],
    notifications: [] as Array<{ report: unknown; textState?: string }>,
    reportMails: [] as IntegrationReport[],
    disk: [] as Array<{ filePath: string; report: IntegrationReport }>,
    a1: [] as IntegrationReport[]
  }

  const integrations: EventIntegration[] = [
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
      runEvent: async (event) => {
        calls.webhooks.push(event.report as IntegrationReport)
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
      runEvent: async (event) => {
        if (event.type === 'report.back_to_in_work') {
          calls.notifications.push({ report: event.report, textState: 'BACK_TO_IN_WORK' })
        } else if (event.type === 'travel.back_to_approved') {
          calls.notifications.push({ report: event.report, textState: 'BACK_TO_APPROVED' })
        } else {
          calls.notifications.push({ report: event.report, textState: undefined })
        }
      }
    },
    {
      handles: (event) => event.type === 'report.review_completed',
      runEvent: async (event) => {
        calls.reportMails.push(event.report as IntegrationReport)
      }
    },
    {
      handles: (event) => event.type === 'report.review_completed',
      runEvent: async (event) => {
        calls.disk.push({ filePath: '/reports/test.pdf', report: event.report as IntegrationReport })
      }
    },
    {
      handles: (event) => ['travel.directly_approved', 'travel.approved'].includes(event.type),
      runEvent: async (event) => {
        const report = event.report as { isCrossBorder: boolean; destinationPlace: { country: { needsA1Certificate: boolean } } }
        if (report.isCrossBorder && report.destinationPlace.country.needsA1Certificate) {
          calls.a1.push(event.report as IntegrationReport)
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
  t.deepEqual(calls.disk, [])
  t.deepEqual(calls.a1, [])
})

test('report.review_completed fans out to all report outbound integrations', async (t) => {
  const report = createReport()
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'report.review_completed', report }, integrations)

  t.deepEqual(calls.webhooks, [report])
  t.deepEqual(calls.notifications, [{ report, textState: undefined }])
  t.deepEqual(calls.reportMails, [report])
  t.deepEqual(calls.disk, [{ filePath: '/reports/test.pdf', report }])
})

test('travel.back_to_approved only triggers notification with custom state label', async (t) => {
  const report = createTravelReport()
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'travel.back_to_approved', report: report as never }, integrations)

  t.deepEqual(calls.webhooks, [])
  t.deepEqual(calls.notifications, [{ report, textState: 'BACK_TO_APPROVED' }])
  t.deepEqual(calls.reportMails, [])
  t.deepEqual(calls.disk, [])
  t.deepEqual(calls.a1, [])
})

test('travel.directly_approved triggers A1 notification when conditions are met', async (t) => {
  const report = createTravelReport({ isCrossBorder: true, destinationPlace: { country: { needsA1Certificate: true } } })
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'travel.directly_approved', report: report as never }, integrations)

  t.deepEqual(calls.webhooks, [report])
  t.deepEqual(calls.notifications, [])
  t.deepEqual(calls.a1, [report])
})

test('travel.directly_approved skips A1 notification when conditions are not met', async (t) => {
  const report = createTravelReport()
  const { calls, integrations } = createIntegrations()

  await emitIntegrationEvent({ type: 'travel.directly_approved', report: report as never }, integrations)

  t.deepEqual(calls.webhooks, [report])
  t.deepEqual(calls.a1, [])
})
