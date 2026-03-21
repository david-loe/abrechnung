import { CronJob } from 'cron'
import { integrationDefinitions } from './registry.js'
import { scheduleToCronTime } from './schedules.js'
import { getResolvedIntegrationSettings } from './settings.js'

const scheduledJobs = new Map<string, CronJob>()
let schedulerStarted = false

function buildJobKey(integrationKey: string, scheduleKey: string) {
  return `${integrationKey}:${scheduleKey}`
}

function stopAllScheduledJobs() {
  for (const job of scheduledJobs.values()) {
    job.stop()
  }
  scheduledJobs.clear()
}

export async function reloadIntegrationSchedules() {
  if (!schedulerStarted) {
    return
  }

  stopAllScheduledJobs()

  for (const definition of integrationDefinitions) {
    const settings = await getResolvedIntegrationSettings(definition.integrationKey)
    for (const scheduledAction of definition.scheduledActions) {
      const scheduleSettings = settings.schedules[scheduledAction.scheduleKey]
      if (!scheduleSettings?.enabled) {
        continue
      }

      const jobKey = buildJobKey(definition.integrationKey, scheduledAction.scheduleKey)
      const job = CronJob.from({ cronTime: scheduleToCronTime(scheduleSettings.schedule), onTick: scheduledAction.onTick, start: true })
      scheduledJobs.set(jobKey, job)
    }
  }
}

export async function startIntegrationScheduler() {
  if (schedulerStarted) {
    return
  }
  schedulerStarted = true
  await reloadIntegrationSchedules()
}

export async function stopIntegrationScheduler() {
  schedulerStarted = false
  stopAllScheduledJobs()
}
