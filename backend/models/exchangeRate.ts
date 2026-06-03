import { exchangeRateProviderNames, ExchangeRate as IExchangeRate } from 'abrechnung-common/types.js'
import { model, Schema } from 'mongoose'

const exchangeRateSchema = () => {
  const schema = new Schema<IExchangeRate>({
    currency: { type: String, ref: 'Currency', required: true },
    rate: { type: Number, min: 0, required: true },
    date: { type: Date, required: true },
    provider: { type: String, enum: exchangeRateProviderNames, required: true }
  })

  schema.index({ provider: 1, currency: 1, date: 1 }, { unique: true })
  return schema
}

const ExchangeRate = model<IExchangeRate>('ExchangeRate', exchangeRateSchema())

export default ExchangeRate
