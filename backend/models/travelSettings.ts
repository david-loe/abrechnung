import { HydratedDocument, Schema, model } from 'mongoose'
import { DistanceRefundType, Meal, TravelSettings, distanceRefundTypes, meals } from '../../common/types.js'
import { reportPrinter, travelCalculator } from '../factory.js'

const distanceRefunds = {} as { [key in DistanceRefundType]: { type: NumberConstructor; min: 0; required: true; label: string } }
for (const refund of distanceRefundTypes) {
  distanceRefunds[refund] = { type: Number, min: 0, required: true, label: 'distanceRefundTypes.' + refund }
}

const lumpSumCut = {} as { [key in Meal]: { type: NumberConstructor; required: true } }
for (const meal of meals) {
  lumpSumCut[meal] = { type: Number, required: true }
}

export const travelSettingsSchema = new Schema<TravelSettings>({
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
})

travelSettingsSchema.post('save', function (this: HydratedDocument<TravelSettings>) {
  travelCalculator.updateSettings(this)
  reportPrinter.setDistanceRefunds(this.distanceRefunds)
})

export default model('TravelSettings', travelSettingsSchema)
