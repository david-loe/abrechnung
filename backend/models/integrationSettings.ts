import { IntegrationSettings, Schedule } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'
import { isValidSchedule } from '../integrations/schedules.js'

const integrationScheduleSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, required: true, default: true, label: 'Enabled' },
    schedule: {
      type: Schema.Types.Mixed,
      required: true,
      validate: { validator: (value: unknown) => isValidSchedule(value), message: 'Invalid schedule' }
    }
  },
  { _id: false }
)

const schema = new Schema<IntegrationSettings<Types.ObjectId>>({
  integrationKey: { type: String, required: true, unique: true, trim: true, index: true },
  schedules: { type: Map, of: integrationScheduleSettingsSchema, required: true, default: () => ({}) }
})

export default model<IntegrationSettings<Types.ObjectId>>('IntegrationSettings', schema)

export function normalizeIntegrationSchedulesForPersistence(
  schedules: IntegrationSettings['schedules']
): Record<string, { enabled: boolean; schedule: Schedule }> {
  return Object.fromEntries(Object.entries(schedules).map(([scheduleKey, value]) => [scheduleKey, { ...value }]))
}
