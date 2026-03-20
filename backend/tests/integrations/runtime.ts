import test, { ExecutionContext } from 'ava'
import ENV from '../../env.js'
import {
  closeIntegrationQueue,
  getJobOptions,
  type IntegrationRuntimeDependencies,
  processIntegrationJob,
  resetIntegrationRuntimeDependenciesForTests,
  runInboundSync,
  runOutboundAction,
  runPolicyAction,
  setIntegrationQueueForTests,
  setIntegrationRuntimeDependenciesForTests
} from '../../integrations/runtime.js'
import { type IntegrationJobData, type IntegrationReport } from '../../integrations/types.js'

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

function createMailRecipient() {
  return { email: 'fry@planetexpress.com', fk: {}, settings: { language: 'de' }, name: { givenName: 'Fry', familyName: 'Fry' } } as const
}

function createPushUser() {
  return { _id: 'user-1', email: 'fry@planetexpress.com' } as never
}

function stubQueueAdd(t: ExecutionContext, implementation: (name: string, data: IntegrationJobData, opts?: unknown) => Promise<unknown>) {
  setIntegrationQueueForTests({ add: implementation as never, close: async () => {} })
  t.teardown(() => {
    setIntegrationQueueForTests(undefined)
  })
}

test.afterEach.always(() => {
  resetIntegrationRuntimeDependenciesForTests()
})

test.after.always(async () => {
  await closeIntegrationQueue()
})

test('getJobOptions returns integration-specific retry settings', (t) => {
  t.deepEqual(getJobOptions('webhooks.deliver'), {
    attempts: ENV.WEBHOOK_ATTEMPTS,
    backoff: { type: 'exponential', delay: ENV.WEBHOOK_RETRY_DELAY }
  })
  t.deepEqual(getJobOptions('reports.write_disk'), { attempts: 6, backoff: { type: 'exponential', delay: 3_000 } })
  t.deepEqual(getJobOptions('notifications.email.send'), { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } })
  t.deepEqual(getJobOptions('lump_sums.sync_in'), {})
})

test.serial('runOutboundAction enqueues the expected outbound job payload', async (t) => {
  const payload = { recipient: createMailRecipient(), subject: 'Subject', paragraph: 'Paragraph', language: 'de' } as const
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined

  stubQueueAdd(t, async (name, data, opts) => {
    captured = { name, data, opts }
    return {} as never
  })

  await runOutboundAction('notifications.email.send', payload)

  t.deepEqual(captured, {
    name: 'notifications.email.send',
    data: { contract: 'outboundAction', action: 'notifications.email.send', payload },
    opts: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } }
  })
})

test.serial('runInboundSync enqueues the expected inbound job payload', async (t) => {
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined

  stubQueueAdd(t, async (name, data, opts) => {
    captured = { name, data, opts }
    return {} as never
  })

  await runInboundSync('lump_sums.sync_in')

  t.deepEqual(captured, {
    name: 'lump_sums.sync_in',
    data: { contract: 'inboundSync', action: 'lump_sums.sync_in', payload: {} },
    opts: {}
  })
})

test.serial('runPolicyAction enqueues the expected policy job payload', async (t) => {
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined

  stubQueueAdd(t, async (name, data, opts) => {
    captured = { name, data, opts }
    return {} as never
  })

  await runPolicyAction('retention.apply')

  t.deepEqual(captured, { name: 'retention.apply', data: { contract: 'policy', action: 'retention.apply', payload: {} }, opts: {} })
})

test.serial('processIntegrationJob dispatches outbound actions to the matching handlers', async (t) => {
  const report = createReport()
  const recipient = createMailRecipient()
  const user = createPushUser()
  const calls = {
    webhooks: [] as unknown[],
    mails: [] as unknown[],
    pushes: [] as unknown[],
    reportMails: [] as unknown[],
    disk: [] as unknown[]
  }

  const deps: IntegrationRuntimeDependencies = {
    isReportDiskEnabled: () => true,
    executeWebhooks: async (payload) => {
      calls.webhooks.push(payload)
    },
    sendMail: async (payload) => {
      calls.mails.push(payload)
    },
    sendPushNotification: async (payload) => {
      calls.pushes.push(payload)
    },
    sendReportViaMail: async (payload) => {
      calls.reportMails.push(payload)
    },
    saveReportOnDisk: async (payload) => {
      calls.disk.push(payload)
    },
    syncLumpSums: async () => {},
    applyRetentionPolicy: async () => {}
  }

  setIntegrationRuntimeDependenciesForTests(deps)

  await processIntegrationJob({ contract: 'outboundAction', action: 'webhooks.deliver', payload: { report } })
  await processIntegrationJob({
    contract: 'outboundAction',
    action: 'notifications.email.send',
    payload: { recipient, subject: 'Subject', paragraph: 'Paragraph', language: 'de' }
  })
  await processIntegrationJob({
    contract: 'outboundAction',
    action: 'notifications.push.send',
    payload: { title: 'Title', body: 'Body', users: [user], url: '/travel/1' }
  })
  await processIntegrationJob({ contract: 'outboundAction', action: 'reports.email.send', payload: { report } })
  await processIntegrationJob({
    contract: 'outboundAction',
    action: 'reports.write_disk',
    payload: { filePath: '/reports/test.pdf', report }
  })

  t.deepEqual(calls.webhooks, [{ report }])
  t.deepEqual(calls.mails, [{ recipient, subject: 'Subject', paragraph: 'Paragraph', language: 'de' }])
  t.deepEqual(calls.pushes, [{ title: 'Title', body: 'Body', users: [user], url: '/travel/1' }])
  t.deepEqual(calls.reportMails, [{ report }])
  t.deepEqual(calls.disk, [{ filePath: '/reports/test.pdf', report }])
})

test.serial('processIntegrationJob skips disk delivery when it is disabled', async (t) => {
  const report = createReport()
  let called = false

  setIntegrationRuntimeDependenciesForTests({
    isReportDiskEnabled: () => false,
    saveReportOnDisk: async () => {
      called = true
    }
  })

  await processIntegrationJob({
    contract: 'outboundAction',
    action: 'reports.write_disk',
    payload: { filePath: '/reports/test.pdf', report }
  })

  t.false(called)
})

test.serial('processIntegrationJob dispatches inbound sync and policy actions', async (t) => {
  let lumpSumSyncs = 0
  let retentionRuns = 0

  setIntegrationRuntimeDependenciesForTests({
    syncLumpSums: async () => {
      lumpSumSyncs += 1
    },
    applyRetentionPolicy: async () => {
      retentionRuns += 1
    }
  })

  await processIntegrationJob({ contract: 'inboundSync', action: 'lump_sums.sync_in', payload: {} })
  await processIntegrationJob({ contract: 'policy', action: 'retention.apply', payload: {} })

  t.is(lumpSumSyncs, 1)
  t.is(retentionRuns, 1)
})
