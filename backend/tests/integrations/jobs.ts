import test from 'ava'
import { type Job, type Queue } from 'bullmq'
import { ConflictError, NotFoundError } from '../../controller/error.js'
import { getWorkerJob, getWorkerJobs, retryWorkerJob } from '../../integrations/jobs.js'
import { closeIntegrationQueue, type IntegrationJobData, setIntegrationQueueForTests } from '../../integrations/queue.js'

function createJob(state: 'completed' | 'failed' = 'completed') {
  let currentState: 'completed' | 'failed' | 'waiting' = state
  const retryCalls: unknown[][] = []
  const job = {
    id: 'job-1',
    name: 'webhooks.deliver',
    data: { integrationKey: 'webhooks', operation: 'deliver', payload: { webhookId: 'hook-1' } },
    opts: { attempts: 3 },
    attemptsMade: state === 'failed' ? 3 : 1,
    timestamp: 1_000,
    processedOn: 1_100,
    finishedOn: 1_200,
    returnvalue: state === 'completed' ? { status: 200 } : null,
    failedReason: state === 'failed' ? 'request failed' : undefined,
    stacktrace: state === 'failed' ? ['Error: request failed'] : [],
    getState: async () => currentState,
    retry: async (...args: unknown[]) => {
      retryCalls.push(args)
      currentState = 'waiting'
    }
  } as unknown as Job<IntegrationJobData, unknown>
  return { job, retryCalls }
}

function stubQueue(jobs: Job<IntegrationJobData, unknown>[], getJob = async (id: string) => jobs.find((job) => job.id === id)) {
  setIntegrationQueueForTests({
    close: async () => {},
    getJob,
    getJobs: async () => jobs,
    getJobCounts: async () => ({ waiting: 0, delayed: 0, active: 0, completed: 1, failed: 0 })
  } as unknown as Queue<IntegrationJobData>)
}

test.afterEach.always(async () => {
  await closeIntegrationQueue()
})

test.serial('getWorkerJobs returns paginated summaries and state counts', async (t) => {
  const { job } = createJob()
  stubQueue([job])

  const result = await getWorkerJobs(undefined, 1, 25)

  t.is(result.meta.count, 1)
  t.is(result.counts.completed, 1)
  t.like(result.data[0], { id: 'job-1', integrationKey: 'webhooks', operation: 'deliver', state: 'completed' })
})

test.serial('getWorkerJob exposes payload, result, and failure diagnostics', async (t) => {
  const { job } = createJob('failed')
  stubQueue([job])

  const result = await getWorkerJob('job-1')

  t.deepEqual(result.data.payload, { webhookId: 'hook-1' })
  t.is(result.data.failedReason, 'request failed')
  t.deepEqual(result.data.stacktrace, ['Error: request failed'])
})

test.serial('retryWorkerJob resets the original failed job attempt counters', async (t) => {
  const { job, retryCalls } = createJob('failed')
  stubQueue([job])

  const result = await retryWorkerJob('job-1')

  t.is(result.state, 'waiting')
  t.deepEqual(retryCalls, [['failed', { resetAttemptsMade: true, resetAttemptsStarted: true }]])
})

test.serial('retryWorkerJob rejects missing and non-failed jobs', async (t) => {
  const { job } = createJob('completed')
  stubQueue([job])

  await t.throwsAsync(() => retryWorkerJob('missing'), { instanceOf: NotFoundError })
  await t.throwsAsync(() => retryWorkerJob('job-1'), { instanceOf: ConflictError })
})
