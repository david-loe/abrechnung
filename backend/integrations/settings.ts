import {
  IntegrationScheduleSettings,
  IntegrationSettings,
  Locale,
  LumpSumIntegrationSettings,
  RetentionIntegrationSettings
} from 'abrechnung-common/types.js'
import mongoose from 'mongoose'
import { NotFoundError } from '../controller/error.js'
import IntegrationSettingsModel from '../models/integrationSettings.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { getIntegration } from './registry.js'

interface IntegrationSettingsPayloadByKey {
  lumpSums: Omit<LumpSumIntegrationSettings, '_id'>
  retentionPolicy: Omit<RetentionIntegrationSettings, '_id'>
}

export type IntegrationSettingsPayload<IntegrationKey extends string = string> =
  IntegrationKey extends keyof IntegrationSettingsPayloadByKey
    ? IntegrationSettingsPayloadByKey[IntegrationKey]
    : Omit<IntegrationSettings, '_id'>

export interface IntegrationSettingsRequestBody {
  schedules: { [scheduleKey: string]: IntegrationScheduleSettings }
  settings: { [key: string]: unknown }
}

function requireIntegration(integrationKey: string) {
  const integration = getIntegration(integrationKey)
  if (!integration) {
    throw new NotFoundError(`No integration found for key '${integrationKey}'.`)
  }

  return integration
}

function requireScheduleOperation(integrationKey: string, operation: string) {
  const integration = requireIntegration(integrationKey)
  if (!integration.hasOperation(operation)) {
    throw new NotFoundError(`No operation '${operation}' found for integration '${integrationKey}'.`)
  }

  return integration
}

function integrationScheduleSettingsSchemaDefinition() {
  return { enabled: { type: Boolean, required: true }, schedule: { specialType: 'schedule', required: true, noColumn: true } }
}

function buildIntegrationScheduleSettingsFormSchema(integrationKey: string, operation: string, language: Locale | readonly Locale[]) {
  requireScheduleOperation(integrationKey, operation)

  const schema = mongooseSchemaToVueformSchema(integrationScheduleSettingsSchemaDefinition(), language, {}, false)
  const scheduleElement = schema.schedule as Record<string, unknown> | undefined
  if (scheduleElement) {
    scheduleElement.scheduleKey = operation
  }

  return schema
}

async function findIntegrationSettings(integrationKey: string) {
  return await mongoose.connection
    .collection<IntegrationSettingsPayload>('integrationsettings')
    .findOne({ integrationKey }, { projection: { _id: 0, __v: 0 } })
}

export async function getIntegrationSettingsFormSchema(integrationKey: string, language: Locale | readonly Locale[]) {
  const integration = requireIntegration(integrationKey)
  const settingsSchemaDefinition = integration.getSettingsFormSchema(language)
  const schema: Record<string, unknown> =
    Object.keys(settingsSchemaDefinition).length > 0 ? mongooseSchemaToVueformSchema(settingsSchemaDefinition, language, {}, false) : {}
  const storedSettings = await findIntegrationSettings(integrationKey)
  const scheduleKeys = storedSettings ? Object.keys(storedSettings.schedules) : []

  if (scheduleKeys.length === 1) {
    Object.assign(schema, buildIntegrationScheduleSettingsFormSchema(integrationKey, scheduleKeys[0], language))
  }

  return schema
}

export async function getIntegrationSettings<IntegrationKey extends keyof IntegrationSettingsPayloadByKey>(
  integrationKey: IntegrationKey
): Promise<IntegrationSettingsPayload<IntegrationKey>>
export async function getIntegrationSettings(integrationKey: string): Promise<IntegrationSettingsPayload>
export async function getIntegrationSettings(integrationKey: string): Promise<IntegrationSettingsPayload> {
  requireIntegration(integrationKey)
  const stored = await findIntegrationSettings(integrationKey)

  if (!stored) {
    throw new NotFoundError(`No integration settings found for key '${integrationKey}'.`)
  }

  return stored
}

export async function getAllIntegrationSettings() {
  return await mongoose.connection
    .collection<IntegrationSettingsPayload>('integrationsettings')
    .find({}, { projection: { _id: 0, __v: 0 } })
    .sort({ integrationKey: 1 })
    .toArray()
}

export async function saveIntegrationSettings<IntegrationKey extends keyof IntegrationSettingsPayloadByKey>(
  integrationKey: IntegrationKey,
  body: IntegrationSettingsPayload<IntegrationKey>
): Promise<IntegrationSettingsPayload<IntegrationKey>>
export async function saveIntegrationSettings(integrationKey: string, body: IntegrationSettingsPayload): Promise<IntegrationSettingsPayload>
export async function saveIntegrationSettings(integrationKey: string, body: IntegrationSettingsPayload) {
  requireIntegration(integrationKey)

  const doc = (await IntegrationSettingsModel.findOne({ integrationKey })) ?? new IntegrationSettingsModel({ integrationKey })
  doc.integrationKey = integrationKey
  doc.schedules = body.schedules
  doc.settings = body.settings
  await doc.validate()
  await doc.save()

  return getIntegrationSettings(integrationKey)
}
