import { logger } from '../logger.js'
import { INTEGRATION_SCHEDULE_PREFIX } from './integration.js'
import { getIntegrationQueue } from './queue.js'
import { getIntegration } from './registry.js'
import { scheduleToRepeatOptions } from './schedules.js'
import { getAllIntegrationSettings } from './settings.js'

export async function syncIntegrationSchedules() {
  const queue = getIntegrationQueue()
  const activeSchedulerKeys = new Set<string>()
  const integrationSettings = await getAllIntegrationSettings()

  for (const settings of integrationSettings) {
    const integration = getIntegration(settings.integrationKey)
    if (!integration) {
      throw new Error(`No integration found for key '${settings.integrationKey}'.`)
    }

    for (const [operation, scheduleSettings] of Object.entries(settings.schedules)) {
      if (!integration.hasOperation(operation)) {
        throw new Error(`No operation '${operation}' found for integration '${integration.key}'.`)
      }

      if (!scheduleSettings.enabled) {
        continue
      }

      const schedulerKey = integration.buildOperationSchedulerId(operation)
      const operationDefinition = integration.requireOperation(operation)
      activeSchedulerKeys.add(schedulerKey)

      await queue.upsertJobScheduler(schedulerKey, scheduleToRepeatOptions(scheduleSettings.schedule), {
        name: integration.buildJobName(operation),
        data: { integrationKey: integration.key, operation, payload: null },
        opts: { removeOnComplete: true, removeOnFail: true, ...operationDefinition.jobOptions }
      })
    }
  }

  const existingSchedulers = await queue.getJobSchedulers()
  for (const scheduler of existingSchedulers) {
    if (!scheduler.key.startsWith(INTEGRATION_SCHEDULE_PREFIX) || activeSchedulerKeys.has(scheduler.key)) {
      continue
    }

    await queue.removeJobScheduler(scheduler.key)
  }

  logger.info(`Synchronized ${activeSchedulerKeys.size} integration schedules`)
}
