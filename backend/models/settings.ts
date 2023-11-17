import '../db.js'
import { HydratedDocument, Document, Schema, model } from 'mongoose'
import {
  Access,
  accesses,
  TravelState,
  HealthCareCostState,
  ExpenseReportState,
  travelStates,
  healthCareCostStates,
  expenseReportStates,
  Settings
} from '../../common/types.js'

const accessIcons: { [key in Access]?: any } = {}
for (const access of accesses) {
  accessIcons[access] = [{ type: String, required: true }]
}

const stateColors: { [key in TravelState | HealthCareCostState | ExpenseReportState]?: any } = {}
const color = { color: { type: String, required: true }, text: { type: String, required: true } }
for (const state of travelStates) {
  stateColors[state] = color
}
for (const state of healthCareCostStates) {
  stateColors[state] = color
}
for (const state of expenseReportStates) {
  stateColors[state] = color
}

const SettingsSchema = new Schema<Settings>({
  accessIcons: accessIcons,
  allowSpouseRefund: { type: Boolean, required: true },
  baseCurrency: { type: String, ref: 'Currency', required: true },
  breakfastCateringLumpSumCut: { type: Number, min: 0, max: 1, required: true },
  lunchCateringLumpSumCut: { type: Number, min: 0, max: 1, required: true },
  dinnerCateringLumpSumCut: { type: Number, min: 0, max: 1, required: true },
  factorCateringLumpSum: { type: Number, min: 0, max: 1, required: true },
  factorCateringLumpSumExceptions: [{ type: String, ref: 'Country' }],
  factorOvernightLumpSum: { type: Number, min: 0, max: 1, required: true },
  factorOvernightLumpSumExceptions: [{ type: String, ref: 'Country' }],
  fallBackLumpSumCountry: { type: String, ref: 'Country', required: true },
  maxTravelDayCount: { type: Number, min: 0, required: true },
  refundPerKM: { type: Number, min: 0, required: true },
  secoundNightOnAirplaneLumpSumCountry: { type: String, ref: 'Country', required: true },
  secoundNightOnShipOrFerryLumpSumCountry: { type: String, ref: 'Country', required: true },
  stateColors: stateColors,
  toleranceStageDatesToApprovedTravelDates: { type: Number, min: 0, required: true },
  uploadTokenExpireAfterSeconds: { type: Number, min: 0, required: true },
  version: { type: String, required: true },
  migrateFrom: { type: String }
})

function populate(doc: Document) {
  return Promise.allSettled([doc.populate({ path: 'baseCurrency' })])
}

SettingsSchema.pre(/^find((?!Update).)*$/, function (this: HydratedDocument<Settings>) {
  populate(this)
})

export default model('Settings', SettingsSchema)
