import { JobsOptions, Queue } from 'bullmq'
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

export function getJobOptions(action: IntegrationJobData['action']): JobsOptions {
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

export async function runOutboundAction<T extends OutboundActionType>(
  action: T,
  payload: OutboundActionPayloadMap[T],
  jobOptions: JobsOptions = {}
) {
  await getIntegrationQueue().add(action, { contract: 'outboundAction', action, payload }, { ...getJobOptions(action), ...jobOptions })
}

export async function runInboundSync<T extends InboundSyncType>(
  action: T,
  payload = {} as InboundSyncPayloadMap[T],
  jobOptions: JobsOptions = {}
) {
  await getIntegrationQueue().add(action, { contract: 'inboundSync', action, payload }, { ...getJobOptions(action), ...jobOptions })
}

export async function runPolicyAction<T extends PolicyActionType>(
  action: T,
  payload = {} as PolicyActionPayloadMap[T],
  jobOptions: JobsOptions = {}
) {
  await getIntegrationQueue().add(action, { contract: 'policy', action, payload }, { ...getJobOptions(action), ...jobOptions })
}

export interface IntegrationRuntimeDependencies {
  isReportDiskEnabled: () => boolean
  executeWebhooks: (payload: OutboundActionPayloadMap['webhooks.deliver']) => Promise<void>
  sendMail: (payload: NotificationEmailPayload) => Promise<void>
  sendPushNotification: (payload: NotificationPushPayload) => Promise<void>
  sendReportViaMail: (payload: OutboundActionPayloadMap['reports.email.send']) => Promise<void>
  saveReportOnDisk: (payload: OutboundActionPayloadMap['reports.write_disk']) => Promise<void>
  syncLumpSums: () => Promise<void>
  applyRetentionPolicy: () => Promise<void>
}

let runtimeDependencies: IntegrationRuntimeDependencies | undefined

export function setIntegrationRuntimeDependenciesForTests(overrides: Partial<IntegrationRuntimeDependencies>) {
  runtimeDependencies = { ...runtimeDependencies, ...overrides } as IntegrationRuntimeDependencies
}

export function resetIntegrationRuntimeDependenciesForTests() {
  runtimeDependencies = undefined
}

export async function processIntegrationJob(job: IntegrationJobData, deps = runtimeDependencies) {
  if (!deps) {
    throw new Error('No integration runtime dependencies configured')
  }

  if (job.contract === 'outboundAction') {
    if (job.action === 'webhooks.deliver') {
      await deps.executeWebhooks(job.payload as OutboundActionPayloadMap['webhooks.deliver'])
      return
    }
    if (job.action === 'notifications.email.send') {
      await deps.sendMail(job.payload as NotificationEmailPayload)
      return
    }
    if (job.action === 'notifications.push.send') {
      await deps.sendPushNotification(job.payload as NotificationPushPayload)
      return
    }
    if (job.action === 'reports.email.send') {
      await deps.sendReportViaMail(job.payload as OutboundActionPayloadMap['reports.email.send'])
      return
    }
    if (job.action === 'reports.write_disk') {
      if (!deps.isReportDiskEnabled()) {
        logger.debug('Report disk delivery disabled, skipping integration job.')
        return
      }
      await deps.saveReportOnDisk(job.payload as OutboundActionPayloadMap['reports.write_disk'])
      return
    }
  }

  if (job.contract === 'inboundSync') {
    if (job.action === 'lump_sums.sync_in') {
      await deps.syncLumpSums()
      return
    }
  }

  if (job.contract === 'policy' && job.action === 'retention.apply') {
    await deps.applyRetentionPolicy()
  }
}
