import { Worker } from 'bullmq'
import ENV from '../env.js'
import { logger } from '../logger.js'
import { sendReportViaMail } from '../pdf/helper.js'
import { applyRetentionPolicy } from '../retentionpolicy.js'
import { syncLumpSums } from './lumpSums/sync.js'
import { sendMail } from './notifications/mail.js'
import { sendPushNotification } from './notifications/push.js'
import { saveReportOnDisk } from './reportDelivery/saveReportOnDisk.js'
import { type IntegrationRuntimeDependencies, processIntegrationJob } from './runtime.js'
import { type IntegrationJobData } from './types.js'
import { executeWebhooks } from './webhooks/execute.js'

const INTEGRATION_QUEUE_NAME = 'integration'

const defaultIntegrationRuntimeDependencies: IntegrationRuntimeDependencies = {
  isReportDiskEnabled: () => ENV.BACKEND_SAVE_REPORTS_ON_DISK,
  executeWebhooks: async (payload) => {
    await executeWebhooks(payload.report)
  },
  sendMail: async (payload) => {
    await sendMail(payload.recipient, payload.subject, payload.paragraph, payload.language, payload.button, payload.lastParagraph)
  },
  sendPushNotification: async (payload) => {
    await sendPushNotification(payload.title, payload.body, payload.users, payload.url)
  },
  sendReportViaMail: async (payload) => {
    await sendReportViaMail(payload.report)
  },
  saveReportOnDisk: async (payload) => {
    await saveReportOnDisk(payload)
  },
  syncLumpSums: async () => {
    await syncLumpSums()
  },
  applyRetentionPolicy: async () => {
    await applyRetentionPolicy()
  }
}

let workerInstance: Worker<IntegrationJobData> | undefined

export function startIntegrationWorker(concurrency = 5) {
  if (workerInstance) {
    return workerInstance
  }

  workerInstance = new Worker<IntegrationJobData>(
    INTEGRATION_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing integration job ${job.id} (${job.data.contract}:${job.data.action})`)
      await processIntegrationJob(job.data, defaultIntegrationRuntimeDependencies)
    },
    { connection: { url: ENV.REDIS_URL }, prefix: ENV.REDIS_PREFIX, concurrency }
  )

  workerInstance.on('completed', (job) => {
    logger.debug(`Integration job ${job.id} completed`)
  })

  workerInstance.on('failed', (job, error) => {
    logger.error(`Integration job ${job?.id} failed (${job?.data.contract}:${job?.data.action})`, error)
  })

  workerInstance.on('error', (error) => {
    logger.error('Integration worker encountered an error', error)
  })

  logger.info('Integration worker started')
  return workerInstance
}
