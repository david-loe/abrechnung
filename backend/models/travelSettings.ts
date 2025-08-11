import { HydratedDocument, model, Schema } from 'mongoose'
import { DistanceRefundType, defaultLastPlaceOfWorkSettings, distanceRefundTypes, Meal, meals, TravelSettings } from '../../common/types.js'
import { approvedTravelsPrinter, reportPrinter, travelCalculator } from '../factory.js'

export const travelSettingsSchema = () => {
  const distanceRefunds = {} as { [key in DistanceRefundType]: { type: NumberConstructor; min: 0; required: true; label: string } }
  for (const refund of distanceRefundTypes) {
    distanceRefunds[refund] = { type: Number, min: 0, required: true, label: `distanceRefundTypes.${refund}` }
  }

  const lumpSumCut = {} as { [key in Meal]: { type: NumberConstructor; required: true } }
  for (const meal of meals) {
    lumpSumCut[meal] = { type: Number, required: true }
  }

  return new Schema<TravelSettings>({
    allowTravelApplicationForThePast: { type: Boolean, required: true },
    allowSpouseRefund: { type: Boolean, required: true },
    maxTravelDayCount: { type: Number, min: 0, required: true },
    toleranceStageDatesToApprovedTravelDates: { type: Number, min: 0, required: true },
    minHoursOfTravel: { type: Number, min: 0, required: true },
    minProfessionalShare: { type: Number, min: 0, max: 1, required: true },
    distanceRefunds: { type: distanceRefunds, required: true },
    vehicleRegistrationWhenUsingOwnCar: { type: String, enum: ['required', 'optional', 'none'], required: true },
    defaultLastPlaceOfWork: { type: String, enum: defaultLastPlaceOfWorkSettings, required: true },
    lumpSumCut: { type: lumpSumCut, required: true },
    factorCateringLumpSum: { type: Number, min: 0, max: 1, required: true },
    factorCateringLumpSumExceptions: { type: [{ type: String, ref: 'Country' }], required: true },
    factorOvernightLumpSum: { type: Number, min: 0, max: 1, required: true },
    factorOvernightLumpSumExceptions: { type: [{ type: String, ref: 'Country' }], required: true },
    fallbackLumpSumCountry: { type: String, ref: 'Country', required: true },
    secondNightOnAirplaneLumpSumCountry: { type: String, ref: 'Country', required: true },
    secondNightOnShipOrFerryLumpSumCountry: { type: String, ref: 'Country', required: true }
  })
}

const schema = travelSettingsSchema()

schema.post('save', function (this: HydratedDocument<TravelSettings>) {
  travelCalculator.updateSettings(this)
  reportPrinter.setDistanceRefunds(this.distanceRefunds)
  approvedTravelsPrinter.setAllowSpouseRefund(this.allowSpouseRefund)
})

export default model('TravelSettings', schema)
