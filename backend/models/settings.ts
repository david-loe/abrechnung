import { Schema, model } from 'mongoose'
import { Access, ReportType, RetentionType, Settings, accesses, reportTypes, retention } from '../../common/types.js'

export const settingsSchema = () => {
  const defaultAccess: { [key in Access]?: { type: BooleanConstructor; required: true; label: string } } = {}
  for (const access of accesses) {
    defaultAccess[access] = { type: Boolean, required: true, label: `accesses.${access}` }
  }

  const disableReportType = {} as { [key in ReportType]: { type: BooleanConstructor; required: true } }
  for (const report of reportTypes) {
    disableReportType[report] = { type: Boolean, required: true }
  }

  const retentionPolicy = {} as {
    [key in RetentionType]: {
      type: NumberConstructor
      min: number
      required: true
      validate: { validator: any; message: string }
      description: string
    }
  }
  for (const policy of retention) {
    retentionPolicy[policy] = {
      type: Number,
      min: 0,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Must be Integer'
      },
      description: `description.${policy}`
    }
  }
  return new Schema<Settings>({
    userCanSeeAllProjects: { type: Boolean, required: true },
    defaultAccess: { type: defaultAccess, required: true },
    disableReportType: { type: disableReportType, required: true },
    retentionPolicy: { type: retentionPolicy, required: true },
    uploadTokenExpireAfterSeconds: { type: Number, min: 0, required: true },
    version: { type: String, required: true, hide: true },
    migrateFrom: { type: String, hide: true }
  })
}

export default model('Settings', settingsSchema())
