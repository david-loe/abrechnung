import { CronJob } from 'cron'
import { scheduledIntegrations } from './registry.js'
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

  for (const integration of scheduledIntegrations) {
    const settings = await getResolvedIntegrationSettings(integration.key)
    for (const scheduledAction of integration.scheduledActions) {
      const scheduleSettings = settings.schedules[scheduledAction.scheduleKey]
      if (!scheduleSettings?.enabled) {
        continue
      }

      const jobKey = buildJobKey(integration.key, scheduledAction.scheduleKey)
      const job = CronJob.from({
        cronTime: scheduleToCronTime(scheduleSettings.schedule),
        onTick: () => integration.runScheduledAction(scheduledAction.scheduleKey),
        start: true
      })
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
