import { randomUUID } from 'node:crypto'
import type { ExecutionContext } from 'ava'
import { Queue, Worker } from 'bullmq'
import ENV from '../env.js'
import { getIntegrationQueue, type IntegrationJobData, setIntegrationQueueForTests } from '../integrations/queue.js'

/** Isolated real Redis queue. Never empty the application's queue. */
export function queueFixture(t: ExecutionContext) {
  const previous = getIntegrationQueue()
  const queue = new Queue<IntegrationJobData>(`test-${randomUUID()}`, { connection: { url: ENV.REDIS_URL } })
  setIntegrationQueueForTests(queue)
  t.teardown(async () => {
    setIntegrationQueueForTests(previous)
    try {
      await queue.obliterate({ force: true })
    } finally {
      await queue.close()
    }
  })
  return queue
}

export async function finishNextJob(queue: Queue<IntegrationJobData>, state: 'completed' | 'failed') {
  const worker = new Worker<IntegrationJobData>(queue.name, undefined, { connection: { url: ENV.REDIS_URL }, autorun: false })
  try {
    const job = await worker.getNextJob('test-worker', { block: false })
    if (!job) throw new Error('No queued job available')
    if (state === 'failed') await job.moveToFailed(new Error('Expected delivery failure'), 'test-worker', false)
    else await job.moveToCompleted({ status: 200 }, 'test-worker', false)
    return job.id
  } finally {
    await worker.close()
  }
}
