import { Advance, ExpenseReport, HealthCareCost, Travel, Webhook } from 'abrechnung-common/types.js'
import { Queue, Worker } from 'bullmq'
import { Types } from 'mongoose'
import ENV from '../env.js'
import { logger } from '../logger.js'
import { processWebhookJob } from '../webhooks/execute.js'

export interface WebhookJobData {
  input: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
  webhook: Webhook<Types.ObjectId>
}

const WEBHOOK_QUEUE_NAME = 'webhook'

export const webhookQueue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
  connection: { url: ENV.REDIS_URL },
  prefix: ENV.REDIS_PREFIX,
  defaultJobOptions: {
    attempts: ENV.WEBHOOK_RETRY_ATTEMPTS,
    backoff: { type: 'exponential', delay: ENV.WEBHOOK_RETRY_DELAY },
    removeOnComplete: { count: 3 },
    removeOnFail: { count: 9 }
  }
})

export async function closeWebhookQueue() {
  await webhookQueue.close()
}

let workerInstance: Worker<WebhookJobData> | undefined

export function startWebhookWorker(concurrency = 1) {
  if (workerInstance) {
    return workerInstance
  }

  workerInstance = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing webhook job ${job.id}`)
      await processWebhookJob(job.data)
    },
    { connection: { url: ENV.REDIS_URL }, prefix: ENV.REDIS_PREFIX, concurrency }
  )

  workerInstance.on('completed', (job) => {
    logger.debug(`Webhook job ${job.id} completed`)
  })

  workerInstance.on('failed', (job, error) => {
    logger.error(`Webhook job ${job?.id} failed`, error)
  })

  workerInstance.on('error', (error) => {
    logger.error('Webhook worker encountered an error', error)
  })

  logger.info('Webhook worker started')
  return workerInstance
}
