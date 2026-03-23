import { Locale, RetentionSettings, RetentionType, retention } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'
import retentionSettings from '../data/retentionSettings.js'
import { isValidSchedule } from '../integrations/schedules.js'
import { mongooseSchemaToVueformSchema } from './vueformGenerator.js'

function retentionPolicySchemaDefinition() {
  const retentionPolicy = {} as {
    [key in RetentionType]: {
      type: NumberConstructor
      min: number
      required: true
      validate: { validator: (value: number) => boolean; message: string }
      description: string
    }
  }

  for (const policy of retention) {
    retentionPolicy[policy] = {
      type: Number,
      min: 0,
      required: true,
      validate: { validator: Number.isInteger, message: 'Must be Integer' },
      description: `description.${policy}`
    }
  }

  return retentionPolicy
}

export function retentionSettingsSchema() {
  const retentionPolicySchema = new Schema(retentionPolicySchemaDefinition(), { _id: false })

  return new Schema<RetentionSettings<Types.ObjectId>>({
    enabled: { type: Boolean, required: true, default: true },
    schedule: {
      type: Schema.Types.Mixed,
      required: true,
      specialType: 'schedule',
      noColumn: true,
      validate: { validator: (value: unknown) => isValidSchedule(value), message: 'Invalid schedule' }
    },
    retentionPolicy: { type: retentionPolicySchema, required: true }
  })
}

const schema = retentionSettingsSchema()

function normalizeRetentionPolicy(retentionPolicy: Partial<RetentionSettings['retentionPolicy']> | null | undefined) {
  return Object.fromEntries(
    retention.map((policy) => [policy, retentionPolicy?.[policy] ?? retentionSettings.retentionPolicy[policy]])
  ) as {
    [key in RetentionType]: number
  }
}

export function buildDefaultRetentionSettings(): RetentionSettings {
  return {
    enabled: retentionSettings.enabled,
    schedule: { ...retentionSettings.schedule },
    retentionPolicy: normalizeRetentionPolicy(retentionSettings.retentionPolicy),
    _id: '' as never
  }
}

export function getRetentionSettingsFormSchema(language: Locale | readonly Locale[]) {
  return mongooseSchemaToVueformSchema(retentionSettingsSchema().obj, language)
}

export async function getResolvedRetentionSettings(): Promise<RetentionSettings> {
  const defaults = buildDefaultRetentionSettings()
  const stored = (await RetentionSettingsModel.findOne({}, { __v: 0 }).lean()) as RetentionSettings | null

  if (!stored) {
    return defaults
  }

  return { ...defaults, ...stored, retentionPolicy: normalizeRetentionPolicy(stored.retentionPolicy) }
}

export async function saveRetentionSettings(settings: Pick<RetentionSettings, 'enabled' | 'schedule' | 'retentionPolicy'>) {
  const normalized = {
    enabled: settings.enabled,
    schedule: settings.schedule,
    retentionPolicy: normalizeRetentionPolicy(settings.retentionPolicy)
  }

  await RetentionSettingsModel.findOneAndUpdate({}, normalized, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true })

  return getResolvedRetentionSettings()
}

const RetentionSettingsModel = model<RetentionSettings<Types.ObjectId>>('RetentionSettings', schema)

export default RetentionSettingsModel
