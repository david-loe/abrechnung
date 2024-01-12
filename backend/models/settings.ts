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
  Settings,
  DistanceRefundType,
  distanceRefundTypes
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

const distanceRefunds: { [key in DistanceRefundType]?: any } = {}
for (const refund of distanceRefundTypes) {
  distanceRefunds[refund] = { type: Number, min: 0, required: true }
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
  distanceRefunds: distanceRefunds,
  secoundNightOnAirplaneLumpSumCountry: { type: String, ref: 'Country', required: true },
  secoundNightOnShipOrFerryLumpSumCountry: { type: String, ref: 'Country', required: true },
  stateColors: stateColors,
  toleranceStageDatesToApprovedTravelDates: { type: Number, min: 0, required: true },
  uploadTokenExpireAfterSeconds: { type: Number, min: 0, required: true },
  allowTravelApplicationForThePast: { type: Boolean, required: true },
  vehicleRegistrationWhenUsingOwnCar: { type: String, enum: ['required', 'optional', 'none'], required: true },
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
