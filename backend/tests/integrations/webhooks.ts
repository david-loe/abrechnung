import { type _id, type Webhook as IWebhook } from 'abrechnung-common/types.js'
import test, { ExecutionContext } from 'ava'
import axios from 'axios'
import { type Queue } from 'bullmq'
import mongoose from 'mongoose'
import { closeIntegrationQueue, type IntegrationJobData, setIntegrationQueueForTests } from '../../integrations/queue.js'
import { webhookIntegration } from '../../integrations/webhooks/integration.js'
import Webhook from '../../models/webhook.js'

function stubQueueAdd(t: ExecutionContext, implementation: (name: string, data: IntegrationJobData, opts?: unknown) => Promise<unknown>) {
  setIntegrationQueueForTests({
    add: implementation as never,
    close: async () => {},
    getJob: async () => undefined,
    getJobSchedulers: async () => [],
    removeJobScheduler: async () => true,
    upsertJobScheduler: async () => ({}) as never
  } as unknown as Queue<IntegrationJobData>)

  t.teardown(() => {
    setIntegrationQueueForTests(undefined)
  })
}

function stubMatchingWebhooks(t: ExecutionContext, hooks: object[]) {
  const originalFind = Webhook.find

  ;(Webhook as { find: typeof Webhook.find }).find = (() => ({ sort: () => ({ lean: async () => hooks }) })) as typeof Webhook.find

  t.teardown(() => {
    ;(Webhook as { find: typeof Webhook.find }).find = originalFind
  })
}

function createWebhook(name: string) {
  return {
    _id: `${name}-id`,
    name,
    executionOrder: 1,
    reportType: ['travel'],
    onState: [10],
    isActive: true,
    request: { url: `https://example.com/${name}`, headers: {}, method: 'POST', convertBodyToFormData: false }
  } satisfies IWebhook<_id>
}

function createReport() {
  return { _id: 'report-1', state: 10, startDate: '2026-04-07' } as const
}

test.after.always(async () => {
  await closeIntegrationQueue()
  await mongoose.disconnect()
})

test.serial('webhook events enqueue all matching hooks as separate jobs', async (t) => {
  const queued: Array<{ name: string; data: IntegrationJobData; opts: unknown }> = []
  const report = createReport()
  const hooks = [createWebhook('first'), createWebhook('second')]
  const deliverJobOptions = webhookIntegration.operations.deliver.jobOptions

  stubMatchingWebhooks(t, hooks)
  stubQueueAdd(t, async (name, data, opts) => {
    queued.push({ name, data, opts })
    return {} as never
  })

  await webhookIntegration.events['report.submitted']?.({ type: 'report.submitted', report } as never)

  t.deepEqual(queued, [
    {
      name: 'webhooks.deliver',
      data: { integrationKey: 'webhooks', operation: 'deliver', payload: { input: report, webhook: hooks[0] } },
      opts: deliverJobOptions
    },
    {
      name: 'webhooks.deliver',
      data: { integrationKey: 'webhooks', operation: 'deliver', payload: { input: report, webhook: hooks[1] } },
      opts: deliverJobOptions
    }
  ])
})

test.serial('webhook delivery processes a single queued hook without enqueueing follow-up work', async (t) => {
  let queued = false
  const report = createReport()
  const originalRequest = axios.request

  stubQueueAdd(t, async (_name, _data, _opts) => {
    queued = true
    return {} as never
  })

  axios.request = (async () =>
    ({
      status: 200,
      headers: {},
      data: {},
      request: { res: { responseUrl: 'https://example.com/first' } }
    }) as never) as typeof axios.request

  t.teardown(() => {
    axios.request = originalRequest
  })

  await webhookIntegration.operations.deliver.run({ input: report as never, webhook: createWebhook('first') })

  t.false(queued)
})
