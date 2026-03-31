import { IntegrationSettings, Locale } from 'abrechnung-common/types.js'
import { NotFoundError } from '../controller/error.js'
import IntegrationSettingsModel from '../models/integrationSettings.js'
import { getResolvedRetentionSettings, saveRetentionSettings } from '../models/retentionSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { getScheduledIntegration } from './registry.js'

export type IntegrationSettingsPayload = Omit<IntegrationSettings, '_id'>

function requireScheduledIntegration(integrationKey: string) {
  const integration = getScheduledIntegration(integrationKey)
  if (!integration) {
    throw new NotFoundError(`No integration found for key '${integrationKey}'.`)
  }

  return integration
}

function requireScheduledAction(integrationKey: string, scheduleKey: string) {
  const integration = requireScheduledIntegration(integrationKey)
  const action = integration.scheduledActions.find((scheduledAction) => scheduledAction.scheduleKey === scheduleKey)
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
  requireScheduledIntegration(integrationKey)
  requireScheduledAction(integrationKey, scheduleKey)

  return mongooseSchemaToVueformSchema(
    { enabled: { type: Boolean, required: true }, schedule: { specialType: 'schedule', required: true, noColumn: true } },
    language,
    {},
    false
  )
}

export function buildDefaultIntegrationSettings(integrationKey: string): IntegrationSettingsPayload {
  const integration = requireScheduledIntegration(integrationKey)

  return {
    integrationKey,
    schedules: Object.fromEntries(
      integration.scheduledActions.map((action) => [
        action.scheduleKey,
        { enabled: action.enabledByDefault, schedule: action.defaultSchedule }
      ])
    )
  }
}

export async function getResolvedIntegrationSettings(integrationKey: string): Promise<IntegrationSettingsPayload> {
  if (integrationKey === 'retentionPolicy') {
    const retentionSettings = await getResolvedRetentionSettings()
    return { integrationKey, schedules: { apply: { enabled: retentionSettings.enabled, schedule: retentionSettings.schedule } } }
  }

  const integration = requireScheduledIntegration(integrationKey)

  const defaults = buildDefaultIntegrationSettings(integrationKey)
  const stored = (await IntegrationSettingsModel.findOne({ integrationKey }, { __v: 0 }).lean()) as IntegrationSettings | null
  if (!stored) {
    return defaults
  }

  const { _id: _storedId, ...storedWithoutId } = stored

  return {
    ...defaults,
    ...storedWithoutId,
    schedules: Object.fromEntries(
      integration.scheduledActions.map((action) => [
        action.scheduleKey,
        stored.schedules?.[action.scheduleKey] ?? defaults.schedules[action.scheduleKey]
      ])
    )
  }
}

export async function saveIntegrationSettings(integrationKey: string, settings: IntegrationSettingsPayload) {
  if (integrationKey === 'retentionPolicy') {
    const currentSettings = await getResolvedRetentionSettings()
    const scheduleSettings = settings.schedules?.apply ?? buildDefaultIntegrationSettings(integrationKey).schedules.apply
    const retentionSettings = await saveRetentionSettings({
      enabled: scheduleSettings.enabled,
      schedule: scheduleSettings.schedule,
      retentionPolicy: currentSettings.retentionPolicy
    })

    return { integrationKey, schedules: { apply: { enabled: retentionSettings.enabled, schedule: retentionSettings.schedule } } }
  }

  const integration = requireScheduledIntegration(integrationKey)

  const defaults = buildDefaultIntegrationSettings(integrationKey)
  const normalized = {
    integrationKey,
    schedules: Object.fromEntries(
      integration.scheduledActions.map((action) => [
        action.scheduleKey,
        settings.schedules?.[action.scheduleKey] ?? defaults.schedules[action.scheduleKey]
      ])
    )
  }

  const doc = (await IntegrationSettingsModel.findOne({ integrationKey })) ?? new IntegrationSettingsModel({ integrationKey })
  doc.schedules = normalized.schedules
  await doc.validate()
  await doc.save()

  return getResolvedIntegrationSettings(integrationKey)
}
