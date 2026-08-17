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
  const getJobsCalls: { states: string[]; start: number; end: number }[] = []
  const getRangesCalls: { states: string[]; start: number; end: number }[] = []
  const getJobCalls: string[] = []
  const entriesForStates = (states: string[]) => entries.filter(({ getState }) => states.includes(getState()))
  setIntegrationQueueForTests({
    close: async () => {},
    getJob: async (id: string) => {
      getJobCalls.push(id)
      return await getJob(id)
    },
    getJobCounts: async (...states: string[]) =>
      Object.fromEntries(states.map((state) => [state, entries.filter(({ getState }) => getState() === state).length])),
    getJobs: async (states: string[], start = 0, end = -1) => {
      getJobsCalls.push({ states, start, end })
      const jobs = entriesForStates(states).map(({ job }) => job)
      return jobs.slice(start, end === -1 ? undefined : end + 1)
    },
    getRanges: async (states: string[], start = 0, end = -1) => {
      getRangesCalls.push({ states, start, end })
      const ids = entriesForStates(states).map(({ job }) => job.id ?? '')
      return ids.slice(start, end === -1 ? undefined : end + 1)
    },
    toKey: (id: string) => id,
    client: Promise.resolve({
      hget: async (id: string, field: string) => {
        if (field !== 'name') return null
        return entries.find(({ job }) => job.id === id)?.job.name ?? null
      }
    })
  } as unknown as Queue<IntegrationJobData>)
  return { getJobsCalls, getRangesCalls, getJobCalls }
}

test.afterEach.always(async () => {
  await closeIntegrationQueue()
})

test.serial('getWorkerJobs filters by exact job name, id, and state before pagination', async (t) => {
  const firstWebhookJob = createJob({ id: 'webhook-1', state: 'completed', timestamp: 200 })
  const secondWebhookJob = createJob({ id: 'webhook-2', state: 'failed', timestamp: 300 })
  const mailJob = createJob({ id: 'mail-1', name: 'notifications.email.send', timestamp: 400 })
  stubQueue([firstWebhookJob, secondWebhookJob, mailJob])

  const firstPage = await getWorkerJobs({ name: 'webhooks.deliver', page: 1, limit: 1 })

  t.is(firstPage.meta.count, 2)
  t.is(firstPage.meta.countPages, 2)
  t.is(firstPage.data[0].id, 'webhook-1')
  t.is(firstPage.counts.completed, 1)
  t.is(firstPage.counts.failed, 1)
  t.deepEqual(firstPage.jobNames, [...firstPage.jobNames].sort())
  t.true(firstPage.jobNames.includes('webhooks.deliver'))

  const completedJobs = await getWorkerJobs({ name: 'webhooks.deliver', state: 'completed', page: 1, limit: 25 })
  t.deepEqual(
    completedJobs.data.map((job) => job.id),
    ['webhook-1']
  )
  t.is(completedJobs.meta.count, 1)

  const idFilteredJobs = await getWorkerJobs({ name: 'webhooks.deliver', id: 'webhook-1', state: 'completed', page: 1, limit: 25 })
  t.deepEqual(
    idFilteredJobs.data.map((job) => job.id),
    ['webhook-1']
  )
  t.is(idFilteredJobs.counts.completed, 1)
  t.is(idFilteredJobs.counts.failed, 0)

  const secondPage = await getWorkerJobs({ name: 'webhooks.deliver', page: 2, limit: 1 })
  t.is(secondPage.data[0].id, 'webhook-2')

  const partialIdDoesNotMatch = await getWorkerJobs({ id: 'webhook', page: 1, limit: 25 })
  t.is(partialIdDoesNotMatch.meta.count, 0)

  const noJobs = await getWorkerJobs({ name: 'webhooks', page: 1, limit: 25 })
  t.is(noJobs.meta.count, 0)
  t.deepEqual(noJobs.data, [])

  const noIdMatch = await getWorkerJobs({ id: 'missing', page: 1, limit: 25 })
  t.is(noIdMatch.meta.count, 0)
})

test.serial('getWorkerJobs paginates across state ranges without unbounded job retrieval', async (t) => {
  const firstCompletedJob = createJob({ id: 'completed-1', state: 'completed' })
  const secondCompletedJob = createJob({ id: 'completed-2', state: 'completed' })
  const firstFailedJob = createJob({ id: 'failed-1', state: 'failed' })
  const secondFailedJob = createJob({ id: 'failed-2', state: 'failed' })
  const calls = stubQueue([firstCompletedJob, secondCompletedJob, firstFailedJob, secondFailedJob])

  const result = await getWorkerJobs({ page: 1, limit: 3 })

  t.deepEqual(
    result.data.map((job) => job.id),
    ['completed-1', 'completed-2', 'failed-1']
  )
  t.deepEqual(calls.getJobsCalls, [
    { states: ['completed'], start: 0, end: 1 },
    { states: ['failed'], start: 0, end: 0 }
  ])
  t.false(calls.getJobsCalls.some(({ end }) => end === -1))
})

test.serial('getWorkerJobs scans names in bounded metadata batches and hydrates only one page', async (t) => {
  const jobs = Array.from({ length: 101 }, (_, index) =>
    createJob({ id: `job-${index}`, name: index % 2 === 0 ? 'webhooks.deliver' : 'notifications.email.send' })
  )
  const calls = stubQueue(jobs)

  const result = await getWorkerJobs({ name: 'webhooks.deliver', page: 2, limit: 2 })

  t.is(result.meta.count, 51)
  t.deepEqual(
    result.data.map((job) => job.id),
    ['job-4', 'job-6']
  )
  t.deepEqual(
    calls.getRangesCalls.filter(({ states }) => states[0] === 'completed'),
    [
      { states: ['completed'], start: 0, end: 99 },
      { states: ['completed'], start: 100, end: 199 }
    ]
  )
  t.deepEqual(calls.getJobCalls, ['job-4', 'job-6'])
  t.deepEqual(calls.getJobsCalls, [])
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
