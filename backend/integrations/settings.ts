import { IntegrationSettings } from 'abrechnung-common/types.js'
import { NotFoundError } from '../controller/error.js'
import IntegrationSettingsModel from '../models/integrationSettings.js'
import { getIntegrationDefinition } from './registry.js'

function requireIntegrationDefinition(integrationKey: string) {
  const definition = getIntegrationDefinition(integrationKey)
  if (!definition) {
    throw new NotFoundError(`No integration found for key '${integrationKey}'.`)
  }

  return definition
}

export function buildDefaultIntegrationSettings(integrationKey: string): IntegrationSettings {
  const definition = requireIntegrationDefinition(integrationKey)

  return {
    integrationKey,
    schedules: Object.fromEntries(
      definition.scheduledActions.map((action) => [
        action.scheduleKey,
        { enabled: action.enabledByDefault, schedule: action.defaultSchedule }
      ])
    ),
    _id: '' as never
  }
}

export async function getResolvedIntegrationSettings(integrationKey: string): Promise<IntegrationSettings> {
  const definition = requireIntegrationDefinition(integrationKey)

  const defaults = buildDefaultIntegrationSettings(integrationKey)
  const stored = (await IntegrationSettingsModel.findOne({ integrationKey }, { __v: 0 }).lean()) as IntegrationSettings | null
  if (!stored) {
    return defaults
  }

  return {
    ...defaults,
    ...stored,
    schedules: Object.fromEntries(
      definition.scheduledActions.map((action) => [
        action.scheduleKey,
        stored.schedules?.[action.scheduleKey] ?? defaults.schedules[action.scheduleKey]
      ])
    )
  }
}

export async function saveIntegrationSettings(integrationKey: string, settings: IntegrationSettings) {
  const definition = requireIntegrationDefinition(integrationKey)

  const defaults = buildDefaultIntegrationSettings(integrationKey)
  const normalized = {
    integrationKey,
    schedules: Object.fromEntries(
      definition.scheduledActions.map((action) => [
        action.scheduleKey,
        settings.schedules?.[action.scheduleKey] ?? defaults.schedules[action.scheduleKey]
      ])
    )
  }

  await IntegrationSettingsModel.findOneAndUpdate(
    { integrationKey },
    { integrationKey, schedules: normalized.schedules },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  )

  return getResolvedIntegrationSettings(integrationKey)
}
