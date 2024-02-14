import { Schema, model } from 'mongoose'
import { ExchangeRate } from '../../common/types.js'

const exchangeRateSchema = new Schema<ExchangeRate>({
  currency: { type: String, ref: 'Currency', required: true },
  value: { type: Number, min: 0, required: true },
  year: { type: Number, min: 1999, required: true },
  month: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], required: true }
})

export default model<ExchangeRate>('ExchangeRate', exchangeRateSchema)
