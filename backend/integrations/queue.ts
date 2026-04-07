import { Queue } from 'bullmq'
import ENV from '../env.js'

const INTEGRATION_QUEUE_NAME = 'integration'

export interface IntegrationJobData {
  integrationKey: string
  operation: string
  payload: unknown
}

let integrationQueue: Queue<IntegrationJobData> | undefined

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

export function setIntegrationQueueForTests(queue: Queue<IntegrationJobData> | undefined) {
  integrationQueue = queue
}

export async function closeIntegrationQueue() {
  if (integrationQueue) {
    await integrationQueue.close()
    integrationQueue = undefined
  }
}

export { INTEGRATION_QUEUE_NAME }
