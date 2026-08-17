import test from 'ava'
import { type Job, type Queue } from 'bullmq'
import { shutdown } from '../../app.js'
import { closeIntegrationQueue, type IntegrationJobData, setIntegrationQueueForTests } from '../../integrations/queue.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
let state: 'failed' | 'waiting' = 'failed'
const job = {
  id: 'job-1',
  name: 'webhooks.deliver',
  data: { integrationKey: 'webhooks', operation: 'deliver', payload: { webhookId: 'hook-1' } },
  opts: { attempts: 3 },
  attemptsMade: 3,
  timestamp: 1_000,
  processedOn: 1_100,
  finishedOn: 1_200,
  returnvalue: null,
  failedReason: 'request failed',
  stacktrace: ['Error: request failed'],
  getState: async () => state,
  retry: async () => {
    state = 'waiting'
  }
} as unknown as Job<IntegrationJobData, unknown>

setIntegrationQueueForTests({
  close: async () => {},
  getJob: async (jobId: string) => (jobId === job.id ? job : undefined),
  getJobs: async (states: string[]) => (states.includes(state) ? [job] : [])
} as unknown as Queue<IntegrationJobData>)

test.serial('worker job endpoints require administrator access', async (t) => {
  await loginUser(agent, 'user')
  t.is((await agent.get('/admin/jobs')).status, 401)
})

test.serial('GET /admin/jobs returns summaries and details', async (t) => {
  await loginUser(agent, 'admin')
  const listResponse = await agent.get('/admin/jobs').query({ name: 'webhooks.deliver', id: 'job-1', state: 'failed', page: 1, limit: 25 })
  const detailsResponse = await agent.get('/admin/jobs/job-1')

  t.is(listResponse.status, 200)
  t.is(listResponse.body.data[0].state, 'failed')
  t.is(listResponse.body.counts.failed, 1)
  t.true(listResponse.body.jobNames.includes('webhooks.deliver'))
  t.is(detailsResponse.status, 200)
  t.deepEqual(detailsResponse.body.data.payload, { webhookId: 'hook-1' })
  t.deepEqual(detailsResponse.body.data.stacktrace, ['Error: request failed'])
})

test.serial('POST /admin/jobs/{jobId}/retry resets the failed job', async (t) => {
  const response = await agent.post('/admin/jobs/job-1/retry').send({})

  t.is(response.status, 200)
  t.is(response.body.result.state, 'waiting')
  t.is(state, 'waiting')
})

test.serial.after.always(async () => {
  await closeIntegrationQueue()
  await shutdown()
})
