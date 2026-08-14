import test from 'ava'
import { type Job, type Queue } from 'bullmq'
import { ConflictError, NotFoundError } from '../../controller/error.js'
import { getWorkerJob, getWorkerJobs, retryWorkerJob } from '../../integrations/jobs.js'
import { closeIntegrationQueue, type IntegrationJobData, setIntegrationQueueForTests } from '../../integrations/queue.js'

type TestJobState = 'completed' | 'failed' | 'waiting'

function createJob({
  id = 'job-1',
  name = 'webhooks.deliver',
  state = 'completed',
  timestamp = 1_000
}: {
  id?: string
  name?: string
  state?: TestJobState
  timestamp?: number
} = {}) {
  let currentState: 'completed' | 'failed' | 'waiting' = state
  const retryCalls: unknown[][] = []
  const job = {
    id,
    name,
    data: {
      integrationKey: name.slice(0, name.lastIndexOf('.')),
      operation: name.slice(name.lastIndexOf('.') + 1),
      payload: { webhookId: 'hook-1' }
    },
    opts: { attempts: 3 },
    attemptsMade: state === 'failed' ? 3 : 1,
    timestamp,
    processedOn: timestamp + 100,
    finishedOn: timestamp + 200,
    returnvalue: state === 'completed' ? { status: 200 } : null,
    failedReason: state === 'failed' ? 'request failed' : undefined,
    stacktrace: state === 'failed' ? ['Error: request failed'] : [],
    getState: async () => currentState,
    retry: async (...args: unknown[]) => {
      retryCalls.push(args)
      currentState = 'waiting'
    }
  } as unknown as Job<IntegrationJobData, unknown>
  return { job, retryCalls, getState: () => currentState }
}

function stubQueue(
  entries: { job: Job<IntegrationJobData, unknown>; getState: () => TestJobState }[],
  getJob = async (id: string) => entries.find(({ job }) => job.id === id)?.job
) {
  setIntegrationQueueForTests({
    close: async () => {},
    getJob,
    getJobs: async (states: string[]) => entries.filter(({ getState }) => states.includes(getState())).map(({ job }) => job)
  } as unknown as Queue<IntegrationJobData>)
}

test.afterEach.always(async () => {
  await closeIntegrationQueue()
})

test.serial('getWorkerJobs filters by exact job name, partial id, and state before sorting and pagination', async (t) => {
  const firstWebhookJob = createJob({ id: 'webhook-1', state: 'completed', timestamp: 200 })
  const secondWebhookJob = createJob({ id: 'webhook-2', state: 'failed', timestamp: 300 })
  const mailJob = createJob({ id: 'mail-1', name: 'notifications.email.send', timestamp: 400 })
  stubQueue([firstWebhookJob, secondWebhookJob, mailJob])

  const firstPage = await getWorkerJobs({ name: 'webhooks.deliver', page: 1, limit: 1, sortDirection: 'desc' })

  t.is(firstPage.meta.count, 2)
  t.is(firstPage.meta.countPages, 2)
  t.is(firstPage.data[0].id, 'webhook-2')
  t.is(firstPage.counts.completed, 1)
  t.is(firstPage.counts.failed, 1)
  t.deepEqual(firstPage.jobNames, [...firstPage.jobNames].sort())
  t.true(firstPage.jobNames.includes('webhooks.deliver'))

  const completedJobs = await getWorkerJobs({ name: 'webhooks.deliver', state: 'completed', page: 1, limit: 25, sortDirection: 'desc' })
  t.deepEqual(
    completedJobs.data.map((job) => job.id),
    ['webhook-1']
  )
  t.is(completedJobs.meta.count, 1)

  const idFilteredJobs = await getWorkerJobs({
    name: 'webhooks.deliver',
    id: 'HOOK-1',
    state: 'completed',
    page: 1,
    limit: 25,
    sortDirection: 'desc'
  })
  t.deepEqual(
    idFilteredJobs.data.map((job) => job.id),
    ['webhook-1']
  )
  t.is(idFilteredJobs.counts.completed, 1)
  t.is(idFilteredJobs.counts.failed, 0)

  const secondAscendingPage = await getWorkerJobs({ name: 'webhooks.deliver', page: 2, limit: 1, sortDirection: 'asc' })
  t.is(secondAscendingPage.data[0].id, 'webhook-2')

  const noJobs = await getWorkerJobs({ name: 'webhooks', page: 1, limit: 25, sortDirection: 'desc' })
  t.is(noJobs.meta.count, 0)
  t.deepEqual(noJobs.data, [])

  const noIdMatch = await getWorkerJobs({ id: 'missing', page: 1, limit: 25, sortDirection: 'desc' })
  t.is(noIdMatch.meta.count, 0)
})

test.serial('getWorkerJobs uses job ids as a deterministic timestamp tie breaker', async (t) => {
  const secondJob = createJob({ id: 'job-2', timestamp: 1_000 })
  const firstJob = createJob({ id: 'job-1', timestamp: 1_000 })
  stubQueue([secondJob, firstJob])

  const result = await getWorkerJobs({ page: 1, limit: 25, sortDirection: 'asc' })

  t.deepEqual(
    result.data.map((job) => job.id),
    ['job-1', 'job-2']
  )
})

test.serial('getWorkerJob exposes payload, result, and failure diagnostics', async (t) => {
  const failedJob = createJob({ state: 'failed' })
  stubQueue([failedJob])

  const result = await getWorkerJob('job-1')

  t.deepEqual(result.data.payload, { webhookId: 'hook-1' })
  t.is(result.data.failedReason, 'request failed')
  t.deepEqual(result.data.stacktrace, ['Error: request failed'])
})

test.serial('retryWorkerJob resets the original failed job attempt counters', async (t) => {
  const failedJob = createJob({ state: 'failed' })
  stubQueue([failedJob])

  const result = await retryWorkerJob('job-1')

  t.is(result.state, 'waiting')
  t.deepEqual(failedJob.retryCalls, [['failed', { resetAttemptsMade: true, resetAttemptsStarted: true }]])
})

test.serial('retryWorkerJob rejects missing and non-failed jobs', async (t) => {
  const completedJob = createJob()
  stubQueue([completedJob])

  await t.throwsAsync(() => retryWorkerJob('missing'), { instanceOf: NotFoundError })
  await t.throwsAsync(() => retryWorkerJob('job-1'), { instanceOf: ConflictError })
})
