import { Access, accesses, exchangeRateProviderNames, ReportType, reportTypes, Settings } from 'abrechnung-common/types.js'
import { model, Schema, Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'

export const settingsSchema = () => {
  const defaultAccess: { [key in Access]?: { type: BooleanConstructor; required: true; label: string } } = {}
  for (const access of accesses) {
    defaultAccess[access] = { type: Boolean, required: true, label: `accesses.${access}` }
  }

  const disableReportType = {} as { [key in ReportType]: { type: BooleanConstructor; required: true } }
  for (const report of reportTypes) {
    disableReportType[report] = { type: Boolean, required: true }
  }

  return new Schema<Settings<Types.ObjectId>>({
    userCanSeeAllProjects: { type: Boolean, required: true },
    onlyShowProjectNamesOnAssigned: { type: Boolean, required: true, conditions: [['userCanSeeAllProjects', true]] },
    autoSelectAvailableAdvances: { type: Boolean, required: true },
    preventOwnersFromDeletingReportsAfterReviewCompleted: { type: Boolean, required: true },
    defaultAccess: { type: defaultAccess, required: true },
    disableReportType: { type: disableReportType, required: true },
    uploadTokenExpireAfterSeconds: { type: Number, min: 0, required: true },
    exchangeRateProvider: { type: String, enum: exchangeRateProviderNames, required: true, translationPrefix: '' },
    isReadOnly: { type: Boolean, required: true, hide: true },
    version: { type: String, required: true, hide: true },
    migrateFrom: { type: String, hide: true }
  })
}

const schema = settingsSchema()

schema.post('save', async () => {
  if (BACKEND_CACHE.initialized) await BACKEND_CACHE.refreshAndPublish()
})

export default model('Settings', schema)
