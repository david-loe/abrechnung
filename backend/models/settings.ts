import '../db.js'
import { HydratedDocument, Document, Schema, model, InferSchemaType, ObtainSchemaGeneric } from 'mongoose'
import {
  Access,
  accesses,
  TravelState,
  HealthCareCostState,
  ExpenseReportState,
  travelStates,
  healthCareCostStates,
  expenseReportStates,
  DistanceRefundType,
  distanceRefundTypes,
  _id,
  Settings
} from '../../common/types.js'

const accessIcons = {} as { [key in Access]: { type: StringConstructor; required: true }[] }
for (const access of accesses) {
  accessIcons[access] = [{ type: String, required: true }]
}

const color = { color: { type: String, required: true }, text: { type: String, required: true } }
const stateColors = {} as { [key in TravelState | HealthCareCostState | ExpenseReportState]: typeof color }
for (const state of travelStates) {
  stateColors[state] = color
}
for (const state of healthCareCostStates) {
  stateColors[state] = color
}
for (const state of expenseReportStates) {
  stateColors[state] = color
}

const distanceRefunds = {} as { [key in DistanceRefundType]: { type: NumberConstructor; min: 0; required: true } }
for (const refund of distanceRefundTypes) {
  distanceRefunds[refund] = { type: Number, min: 0, required: true }
}

const settingsSchema = new Schema<Settings>({
  accessIcons: { type: accessIcons, required: true },
  allowSpouseRefund: { type: Boolean, required: true },
  breakfastCateringLumpSumCut: { type: Number, min: 0, max: 1, required: true },
  lunchCateringLumpSumCut: { type: Number, min: 0, max: 1, required: true },
  dinnerCateringLumpSumCut: { type: Number, min: 0, max: 1, required: true },
  factorCateringLumpSum: { type: Number, min: 0, max: 1, required: true },
  factorCateringLumpSumExceptions: [{ type: String, ref: 'Country' }],
  factorOvernightLumpSum: { type: Number, min: 0, max: 1, required: true },
  factorOvernightLumpSumExceptions: [{ type: String, ref: 'Country' }],
  fallBackLumpSumCountry: { type: String, ref: 'Country', required: true },
  maxTravelDayCount: { type: Number, min: 0, required: true },
  distanceRefunds: { type: distanceRefunds, required: true },
  secoundNightOnAirplaneLumpSumCountry: { type: String, ref: 'Country', required: true },
  secoundNightOnShipOrFerryLumpSumCountry: { type: String, ref: 'Country', required: true },
  stateColors: { type: stateColors, required: true },
  toleranceStageDatesToApprovedTravelDates: { type: Number, min: 0, required: true },
  uploadTokenExpireAfterSeconds: { type: Number, min: 0, required: true },
  allowTravelApplicationForThePast: { type: Boolean, required: true },
  vehicleRegistrationWhenUsingOwnCar: { type: String, enum: ['required', 'optional', 'none'], required: true },
  version: { type: String, required: true },
  migrateFrom: { type: String }
})

export type SettingsSchema = InferSchemaType<typeof settingsSchema>
export type ISettings = SettingsSchema & { _id: _id }

export default model('Settings', settingsSchema)
