import { JobsOptions, Queue, Worker } from 'bullmq'
import ENV from '../env.js'
import { logger } from '../logger.js'
import {
  type InboundSyncPayloadMap,
  type InboundSyncType,
  type IntegrationJobData,
  type NotificationEmailPayload,
  type NotificationPushPayload,
  type OutboundActionPayloadMap,
  type OutboundActionType,
  type PolicyActionPayloadMap,
  type PolicyActionType
} from './types.js'

const INTEGRATION_QUEUE_NAME = 'integration'

export const integrationQueue = new Queue<IntegrationJobData>(INTEGRATION_QUEUE_NAME, {
  connection: { url: ENV.REDIS_URL },
  prefix: ENV.REDIS_PREFIX,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 3 },
    removeOnFail: { count: 9 }
  }
})

export async function closeIntegrationQueue() {
  await integrationQueue.close()
}

function getJobOptions(action: IntegrationJobData['action']): JobsOptions {
  if (action === 'webhooks.deliver') {
    return { attempts: ENV.WEBHOOK_ATTEMPTS, backoff: { type: 'exponential', delay: ENV.WEBHOOK_RETRY_DELAY } }
  }
  if (action === 'reports.write_disk') {
    return { attempts: 6, backoff: { type: 'exponential', delay: 3_000 } }
  }
  if (action === 'notifications.email.send' || action === 'reports.email.send') {
    return { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } }
  }
  return {}
}

export async function runOutboundAction<T extends OutboundActionType>(action: T, payload: OutboundActionPayloadMap[T]) {
  await integrationQueue.add(action, { contract: 'outboundAction', action, payload }, getJobOptions(action))
}

export async function runInboundSync<T extends InboundSyncType>(action: T, payload = {} as InboundSyncPayloadMap[T]) {
  await integrationQueue.add(action, { contract: 'inboundSync', action, payload }, getJobOptions(action))
}

export async function runPolicyAction<T extends PolicyActionType>(action: T, payload = {} as PolicyActionPayloadMap[T]) {
  await integrationQueue.add(action, { contract: 'policy', action, payload }, getJobOptions(action))
}

export async function processIntegrationJob(job: IntegrationJobData) {
  if (job.contract === 'outboundAction') {
    if (job.action === 'webhooks.deliver') {
      const { executeWebhooks } = await import('./webhooks/execute.js')
      await executeWebhooks((job.payload as OutboundActionPayloadMap['webhooks.deliver']).report)
      return
    }
    if (job.action === 'notifications.email.send') {
      const payload = job.payload as NotificationEmailPayload
      const { sendMail } = await import('./notifications/mail.js')
      await sendMail(payload.recipient, payload.subject, payload.paragraph, payload.language, payload.button, payload.lastParagraph)
      return
    }
    if (job.action === 'notifications.push.send') {
      const payload = job.payload as NotificationPushPayload
      const { sendPushNotification } = await import('./notifications/push.js')
      await sendPushNotification(payload.title, payload.body, payload.users, payload.url)
      return
    }
    if (job.action === 'reports.email.send') {
      const { sendReportViaMail } = await import('../pdf/helper.js')
      await sendReportViaMail((job.payload as OutboundActionPayloadMap['reports.email.send']).report)
      return
    }
    if (job.action === 'reports.write_disk') {
      if (!ENV.BACKEND_SAVE_REPORTS_ON_DISK) {
        logger.debug('Report disk delivery disabled, skipping integration job.')
        return
      }
      const { saveReportOnDisk } = await import('./reportDelivery/saveReportOnDisk.js')
      await saveReportOnDisk(job.payload as OutboundActionPayloadMap['reports.write_disk'])
      return
    }
  }

  if (job.contract === 'inboundSync') {
    if (job.action === 'lump_sums.sync_in') {
      const { syncLumpSums } = await import('../db.js')
      await syncLumpSums()
      return
    }
  }

  if (job.contract === 'policy' && job.action === 'retention.apply') {
    const { applyRetentionPolicy } = await import('../retentionpolicy.js')
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
      await processIntegrationJob(job.data)
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
