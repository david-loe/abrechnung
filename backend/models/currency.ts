import { Currency } from 'abrechnung-common/types.js'
import { model, Schema } from 'mongoose'

export const currencySchema = () =>
  new Schema<Currency>({
    _id: { type: String, required: true, trim: true, alias: 'code', label: 'labels.code' },
    name: { type: { de: { type: String, required: true, trim: true }, en: { type: String, required: true, trim: true } }, required: true },
    symbol: { type: String, trim: true },
    subunit: { type: String, trim: true },
    flag: { type: String }
  })

export default model<Currency>('Currency', currencySchema())
