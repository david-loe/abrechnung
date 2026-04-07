import { Worker } from 'bullmq'
import ENV from '../env.js'
import { logger } from '../logger.js'
import { processIntegrationJob } from './processor.js'
import { INTEGRATION_QUEUE_NAME, type IntegrationJobData } from './queue.js'

let workerInstance: Worker<IntegrationJobData> | undefined

function describeJob(data: IntegrationJobData) {
  return `${data.integrationKey}:${data.operation}`
}

export async function startIntegrationWorker() {
  if (workerInstance) {
    return workerInstance
  }

  const worker = new Worker<IntegrationJobData>(
    INTEGRATION_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing integration job ${job.id} (${describeJob(job.data)})`)
      await processIntegrationJob(job.data)
    },
    { connection: { url: ENV.REDIS_URL }, prefix: ENV.REDIS_PREFIX, concurrency: ENV.WORKER_CONCURRENCY }
  )

  worker.on('completed', (job) => {
    logger.debug(`Integration job ${job.id} completed`)
  })

  worker.on('failed', (job, error) => {
    logger.error(`Integration job ${job?.id} failed (${job ? describeJob(job.data) : 'unknown'})`, error)
  })

  worker.on('error', (error) => {
    logger.error('Integration worker encountered an error', error)
  })

  await worker.waitUntilReady()
  workerInstance = worker
  logger.info('Integration worker started')
  return workerInstance
}
