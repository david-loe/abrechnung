import { JobsOptions, KeepJobs, Queue } from 'bullmq'
import ENV from '../env.js'

const INTEGRATION_QUEUE_NAME = 'integration'

export interface IntegrationJobData {
  integrationKey: string
  operation: string
  payload: unknown
}

let integrationQueue: Queue<IntegrationJobData> | undefined

function createIntegrationQueue() {
  return new Queue<IntegrationJobData>(INTEGRATION_QUEUE_NAME, { connection: { url: ENV.REDIS_URL }, prefix: ENV.REDIS_PREFIX })
}

function buildKeepJobs(age: number | false, count: number | false): KeepJobs | number | false {
  if (age === false) return count
  return { age, ...(count === false ? {} : { count }) }
}

export function getIntegrationJobRetentionOptions(): Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'> {
  return {
    removeOnComplete: buildKeepJobs(ENV.WORKER_JOB_COMPLETED_TTL_SECONDS, ENV.WORKER_JOB_COMPLETED_MAX_COUNT),
    removeOnFail: buildKeepJobs(ENV.WORKER_JOB_FAILED_TTL_SECONDS, ENV.WORKER_JOB_FAILED_MAX_COUNT)
  }
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
