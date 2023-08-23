import { Schema, model } from 'mongoose'
import { Currency } from '../../common/types.js'

const currencySchema = new Schema<Currency>({
  name: {
    de: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true }
  },
  _id: { type: String, required: true, trim: true, alias: 'code' },
  subunit: { type: String, trim: true },
  symbol: { type: String, trim: true },
  flag: { type: String }
})

export default model<Currency>('Currency', currencySchema)
