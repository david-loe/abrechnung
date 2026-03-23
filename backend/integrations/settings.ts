import { IntegrationSettings, Locale } from 'abrechnung-common/types.js'
import { NotFoundError } from '../controller/error.js'
import IntegrationSettingsModel from '../models/integrationSettings.js'
import { getResolvedRetentionSettings, saveRetentionSettings } from '../models/retentionSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { getIntegrationDefinition } from './registry.js'

function requireIntegrationDefinition(integrationKey: string) {
  const definition = getIntegrationDefinition(integrationKey)
  if (!definition) {
    throw new NotFoundError(`No integration found for key '${integrationKey}'.`)
  }

  return definition
}

function requireScheduledActionDefinition(integrationKey: string, scheduleKey: string) {
  const definition = requireIntegrationDefinition(integrationKey)
  const action = definition.scheduledActions.find((scheduledAction) => scheduledAction.scheduleKey === scheduleKey)
  if (!action) {
    throw new NotFoundError(`No schedule '${scheduleKey}' found for integration '${integrationKey}'.`)
  }

  return action
}

export function getIntegrationScheduleSettingsFormSchema(
  integrationKey: string,
  scheduleKey: string,
  language: Locale | readonly Locale[]
) {
  requireIntegrationDefinition(integrationKey)
  requireScheduledActionDefinition(integrationKey, scheduleKey)

  return mongooseSchemaToVueformSchema(
    { enabled: { type: Boolean, required: true }, schedule: { specialType: 'schedule', required: true, noColumn: true } },
    language,
    {},
    false
  )
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
  if (integrationKey === 'retentionPolicy') {
    const retentionSettings = await getResolvedRetentionSettings()
    return {
      integrationKey,
      schedules: { apply: { enabled: retentionSettings.enabled, schedule: retentionSettings.schedule } },
      _id: retentionSettings._id as never
    }
  }

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
  if (integrationKey === 'retentionPolicy') {
    const currentSettings = await getResolvedRetentionSettings()
    const scheduleSettings = settings.schedules?.apply ?? buildDefaultIntegrationSettings(integrationKey).schedules.apply
    const retentionSettings = await saveRetentionSettings({
      enabled: scheduleSettings.enabled,
      schedule: scheduleSettings.schedule,
      retentionPolicy: currentSettings.retentionPolicy
    })

    return {
      integrationKey,
      schedules: { apply: { enabled: retentionSettings.enabled, schedule: retentionSettings.schedule } },
      _id: retentionSettings._id as never
    }
  }

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
