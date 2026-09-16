import { randomUUID } from 'node:crypto'
import test from 'ava'
import { Queue, Worker } from 'bullmq'
import ENV from '../../env.js'
import { getWorkerJobs, retryWorkerJob } from '../../integrations/jobs.js'
import { type IntegrationJobData, setIntegrationQueueForTests } from '../../integrations/queue.js'

function createQueue() {
  return new Queue<IntegrationJobData>(`worker-job-test-${randomUUID()}`, { connection: { url: ENV.REDIS_URL } })
}

test.serial('Redis job name filtering counts and paginates beyond the first metadata batch', async (t) => {
  const queue = createQueue()
  setIntegrationQueueForTests(queue)
  t.teardown(async () => {
    setIntegrationQueueForTests(undefined)
    try {
      await queue.obliterate()
    } finally {
      await queue.close()
    }
  })

  await queue.addBulk(
    Array.from({ length: 105 }, (_, index) => ({
      name: index % 2 === 0 ? 'webhooks.deliver' : 'notifications.email.send',
      data: { integrationKey: 'test', operation: 'run', payload: { index } },
      opts: { jobId: `job-${index}` }
    }))
  )

  const secondPage = await getWorkerJobs({ name: 'webhooks.deliver', state: 'waiting', page: 2, limit: 2 })
  t.is(secondPage.meta.count, 53)
  t.is(secondPage.meta.countPages, 27)
  t.is(secondPage.counts.waiting, 53)
  t.deepEqual(
    secondPage.data.map(({ id }) => id),
    ['job-100', 'job-98']
  )

  const lastPage = await getWorkerJobs({ name: 'webhooks.deliver', page: 27, limit: 2 })
  t.deepEqual(
    lastPage.data.map(({ id }) => id),
    ['job-0']
  )
  const noMatch = await getWorkerJobs({ name: 'webhooks', page: 1, limit: 2 })
  t.is(noMatch.meta.count, 0)
  t.deepEqual(noMatch.data, [])
})

test.serial('Redis failed jobs can be filtered, retried, and completed by a worker', async (t) => {
  const queue = createQueue()
  const worker = new Worker<IntegrationJobData>(queue.name, undefined, { connection: { url: ENV.REDIS_URL }, autorun: false })
  setIntegrationQueueForTests(queue)
  t.teardown(async () => {
    setIntegrationQueueForTests(undefined)
    try {
      await worker.close()
      await queue.obliterate({ force: true })
    } finally {
      await queue.close()
    }
  })

  await queue.add('webhooks.deliver', { integrationKey: 'test', operation: 'run', payload: null }, { jobId: 'retry-job', attempts: 1 })
  const failedJob = await worker.getNextJob('first-attempt', { block: false })
  if (!failedJob) throw new Error('Expected retry-job to be available for the first attempt')
  await failedJob.moveToFailed(new Error('Expected test failure'), 'first-attempt', false)

  const failed = await getWorkerJobs({ name: 'webhooks.deliver', state: 'failed', page: 1, limit: 25 })
  t.is(failed.meta.count, 1)
  t.is(failed.data[0].attemptsMade, 1)
  t.is((await retryWorkerJob('retry-job')).state, 'waiting')
  t.is((await queue.getJob('retry-job'))?.attemptsMade, 0)

  const retriedJob = await worker.getNextJob('second-attempt', { block: false })
  if (!retriedJob) throw new Error('Expected retry-job to be available for the second attempt')
  t.is(retriedJob.id, 'retry-job')
  await retriedJob.moveToCompleted({ ok: true }, 'second-attempt', false)

  const completed = await getWorkerJobs({ name: 'webhooks.deliver', state: 'completed', page: 1, limit: 25 })
  t.is(completed.meta.count, 1)
  t.is(completed.counts.failed, 0)
  t.is(completed.data[0].id, 'retry-job')
})
