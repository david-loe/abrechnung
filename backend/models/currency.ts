import { Currency, Locale, locales } from 'abrechnung-common/types.js'
import { model, Schema } from 'mongoose'

export const currencySchema = () => {
  const names = {} as { [key in Locale]: { type: StringConstructor; required: true; trim: true; label: string } }
  for (const locale of locales) {
    names[locale] = { type: String, required: true, trim: true, label: `languages.${locale}` }
  }

  return new Schema<Currency>({
    _id: { type: String, required: true, trim: true, alias: 'code', label: 'labels.code' },
    name: { type: names, required: true },
    symbol: { type: String, trim: true },
    subunit: { type: String, trim: true },
    flag: { type: String }
  })
}

export default model<Currency>('Currency', currencySchema())
