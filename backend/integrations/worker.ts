import { Worker } from 'bullmq'
import ENV from '../env.js'
import { logger } from '../logger.js'
import { processIntegrationJob } from './processor.js'
import { INTEGRATION_QUEUE_NAME } from './queue.js'
import { type IntegrationJobData } from './types.js'

let workerInstance: Worker<IntegrationJobData> | undefined

export function startIntegrationWorker(concurrency = 5) {
  if (workerInstance) {
    return workerInstance
  }

  workerInstance = new Worker<IntegrationJobData>(
    INTEGRATION_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing integration job ${job.id} (${job.data.integrationKey}:${job.data.operation})`)
      await processIntegrationJob(job.data)
    },
    { connection: { url: ENV.REDIS_URL }, prefix: ENV.REDIS_PREFIX, concurrency }
  )

  workerInstance.on('completed', (job) => {
    logger.debug(`Integration job ${job.id} completed`)
  })

  workerInstance.on('failed', (job, error) => {
    logger.error(`Integration job ${job?.id} failed (${job?.data.integrationKey}:${job?.data.operation})`, error)
  })

  workerInstance.on('error', (error) => {
    logger.error('Integration worker encountered an error', error)
  })

  logger.info('Integration worker started')
  return workerInstance
}
