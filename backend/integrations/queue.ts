import { Queue } from 'bullmq'
import ENV from '../env.js'
import { type IntegrationJobData } from './types.js'

const INTEGRATION_QUEUE_NAME = 'integration'

export type IntegrationQueueJob = { getState: () => Promise<string>; remove: () => Promise<void> }

type IntegrationQueue = Pick<Queue<IntegrationJobData>, 'add' | 'close' | 'getJob'>

let integrationQueue: IntegrationQueue | undefined

function createIntegrationQueue() {
  return new Queue<IntegrationJobData>(INTEGRATION_QUEUE_NAME, {
    connection: { url: ENV.REDIS_URL },
    prefix: ENV.REDIS_PREFIX,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 3 },
      removeOnFail: { count: 9 }
    }
  })
}

export function getIntegrationQueue() {
  if (!integrationQueue) {
    integrationQueue = createIntegrationQueue()
  }

  return integrationQueue
}

export function setIntegrationQueueForTests(queue: IntegrationQueue | undefined) {
  integrationQueue = queue
}

export async function closeIntegrationQueue() {
  if (integrationQueue) {
    await integrationQueue.close()
    integrationQueue = undefined
  }
}

export { INTEGRATION_QUEUE_NAME }
