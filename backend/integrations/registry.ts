import { Schedule } from 'abrechnung-common/types.js'
import { fetchAndUpdateLumpSums } from './lumpSums/trigger.js'
import { retentionPolicy } from './policies/trigger.js'

export interface IntegrationScheduledActionDefinition {
  scheduleKey: string
  defaultSchedule: Schedule
  enabledByDefault: boolean
  onTick: () => Promise<void>
}

export interface IntegrationDefinition {
  integrationKey: string
  scheduledActions: IntegrationScheduledActionDefinition[]
}

export const integrationDefinitions: IntegrationDefinition[] = [
  {
    integrationKey: 'lumpSums',
    scheduledActions: [
      {
        scheduleKey: 'sync',
        defaultSchedule: { type: 'daily', hour: 1, minute: 0 },
        enabledByDefault: true,
        onTick: fetchAndUpdateLumpSums
      }
    ]
  },
  {
    integrationKey: 'retentionPolicy',
    scheduledActions: [
      { scheduleKey: 'apply', defaultSchedule: { type: 'daily', hour: 1, minute: 0 }, enabledByDefault: true, onTick: retentionPolicy }
    ]
  }
]

export function getIntegrationDefinition(integrationKey: string) {
  return integrationDefinitions.find((definition) => definition.integrationKey === integrationKey)
}
