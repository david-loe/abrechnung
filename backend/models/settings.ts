import { Access, accesses, ReportType, RetentionType, reportTypes, retention, Settings } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'

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
      validate: { validator: (arg0: number) => boolean; message: string }
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
  return new Schema<Settings<Types.ObjectId>>({
    userCanSeeAllProjects: { type: Boolean, required: true },
    onlyShowProjectNamesOnAssigned: { type: Boolean, required: true, conditions: [['userCanSeeAllProjects', true]] },
    autoSelectAvailableAdvances: { type: Boolean, required: true },
    preventOwnersFromDeletingReportsAfterReviewCompleted: { type: Boolean, required: true },
    defaultAccess: { type: defaultAccess, required: true },
    disableReportType: { type: disableReportType, required: true },
    retentionPolicy: { type: retentionPolicy, required: true },
    uploadTokenExpireAfterSeconds: { type: Number, min: 0, required: true },
    version: { type: String, required: true, hide: true },
    migrateFrom: { type: String, hide: true }
  })
}

export default model('Settings', settingsSchema())
