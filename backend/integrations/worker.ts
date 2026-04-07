import { Worker } from 'bullmq'
import ENV from '../env.js'
import { logger } from '../logger.js'
import { processIntegrationJob } from './processor.js'
import { INTEGRATION_QUEUE_NAME, type IntegrationJobData } from './queue.js'
import { integrations } from './registry.js'

let workerPromise: Promise<Worker<IntegrationJobData>> | null = null

function describeJob(data: IntegrationJobData) {
  return `${data.integrationKey}:${data.operation}`
}

function createIntegrationWorker() {
  return new Worker<IntegrationJobData>(
    INTEGRATION_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing integration job ${job.id} (${describeJob(job.data)})`)
      await processIntegrationJob(job.data, integrations)
    },
    { connection: { url: ENV.REDIS_URL }, prefix: ENV.REDIS_PREFIX, concurrency: ENV.WORKER_CONCURRENCY }
  )
}

function registerWorkerListeners(worker: Worker<IntegrationJobData>) {
  worker.on('completed', (job) => {
    logger.debug(`Integration job ${job.id} completed`)
  })

  worker.on('failed', (job, error) => {
    logger.error(`Integration job ${job?.id} failed (${job ? describeJob(job.data) : 'unknown'})`, error)
  })

  worker.on('error', (error) => {
    logger.error('Integration worker encountered an error', error)
  })
}

export function startIntegrationWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = createIntegrationWorker()
      registerWorkerListeners(worker)
      await worker.waitUntilReady()
      logger.info('Integration worker started')
      return worker
    })()
  }

  return workerPromise
}
