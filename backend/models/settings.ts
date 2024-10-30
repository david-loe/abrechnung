import { HydratedDocument, InferSchemaType, Schema, model } from 'mongoose'
import {
  Access,
  DistanceRefundType,
  ExpenseReportState,
  HealthCareCostState,
  Meal,
  ReportType,
  RetentionType,
  Settings,
  TravelState,
  _id,
  accesses,
  distanceRefundTypes,
  expenseReportStates,
  healthCareCostStates,
  meals,
  reportTypes,
  retention,
  travelStates
} from '../../common/types.js'
import { travelCalculator } from './travel.js'

const accessIcons = {} as { [key in Access]: { type: { type: StringConstructor; required: true }[]; required: true; label: string } }
for (const access of accesses) {
  accessIcons[access] = { type: [{ type: String, required: true }], required: true, label: 'accesses.' + access }
}

const defaultAccess: { [key in Access]?: { type: BooleanConstructor; required: true; label: string } } = {}
for (const access of accesses) {
  defaultAccess[access] = { type: Boolean, required: true, label: 'accesses.' + access }
}

function color(state: string) {
  return {
    type: { color: { type: String, required: true }, text: { type: String, required: true } },
    required: true,
    label: 'states.' + state
  }
}
const stateColors = {} as { [key in TravelState | HealthCareCostState | ExpenseReportState]: ReturnType<typeof color> }
for (const state of travelStates) {
  stateColors[state] = color(state)
}
for (const state of healthCareCostStates) {
  stateColors[state] = color(state)
}
for (const state of expenseReportStates) {
  stateColors[state] = color(state)
}

const distanceRefunds = {} as { [key in DistanceRefundType]: { type: NumberConstructor; min: 0; required: true; label: string } }
for (const refund of distanceRefundTypes) {
  distanceRefunds[refund] = { type: Number, min: 0, required: true, label: 'distanceRefundTypes.' + refund }
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
    description: 'description.' + policy
  }
}

const lumpSumCut = {} as { [key in Meal]: { type: NumberConstructor; required: true } }
for (const meal of meals) {
  lumpSumCut[meal] = { type: Number, required: true }
}

export const settingsSchema = new Schema<Settings>({
  userCanSeeAllProjects: { type: Boolean, required: true },
  defaultAccess: { type: defaultAccess, required: true },
  disableReportType: { type: disableReportType, required: true },
  retentionPolicy: { type: retentionPolicy, required: true },
  travelSettings: {
    type: {
      maxTravelDayCount: { type: Number, min: 0, required: true },
      allowSpouseRefund: { type: Boolean, required: true },
      allowTravelApplicationForThePast: { type: Boolean, required: true },
      toleranceStageDatesToApprovedTravelDates: { type: Number, min: 0, required: true },
      distanceRefunds: { type: distanceRefunds, required: true },
      vehicleRegistrationWhenUsingOwnCar: { type: String, enum: ['required', 'optional', 'none'], required: true },
      lumpSumCut: { type: lumpSumCut, required: true },
      factorCateringLumpSum: { type: Number, min: 0, max: 1, required: true },
      factorCateringLumpSumExceptions: { type: [{ type: String, ref: 'Country' }], required: true },
      factorOvernightLumpSum: { type: Number, min: 0, max: 1, required: true },
      factorOvernightLumpSumExceptions: { type: [{ type: String, ref: 'Country' }], required: true },
      fallBackLumpSumCountry: { type: String, ref: 'Country', required: true },
      secondNightOnAirplaneLumpSumCountry: { type: String, ref: 'Country', required: true },
      secondNightOnShipOrFerryLumpSumCountry: { type: String, ref: 'Country', required: true },
      minHoursOfTravel: { type: Number, min: 0, required: true },
      minProfessionalShare: { type: Number, min: 0, max: 1, required: true }
    },
    required: true
  },

  uploadTokenExpireAfterSeconds: { type: Number, min: 0, required: true },
  stateColors: { type: stateColors, required: true },
  accessIcons: { type: accessIcons, required: true },
  version: { type: String, required: true, hide: true },
  migrateFrom: { type: String, hide: true }
})

export type SettingsSchema = InferSchemaType<typeof settingsSchema>
export type ISettings = SettingsSchema & { _id: _id }

settingsSchema.post('save', function (this: HydratedDocument<Settings>) {
  travelCalculator.updateSettings(this.travelSettings)
})

export default model('Settings', settingsSchema)
