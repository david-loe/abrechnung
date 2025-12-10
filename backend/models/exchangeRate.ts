import { ExchangeRate as IExchangeRate } from 'abrechnung-common/types.js'
import { model, Schema } from 'mongoose'

const exchangeRateSchema = () =>
  new Schema<IExchangeRate>({
    currency: { type: String, ref: 'Currency', required: true },
    value: { type: Number, min: 0, required: true },
    year: { type: Number, min: 1_999, required: true },
    month: { type: Number, enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], required: true }
  })

const ExchangeRate = model<IExchangeRate>('ExchangeRate', exchangeRateSchema())

export default ExchangeRate
