import { Country, Locale, locales } from 'abrechnung-common/types.js'
import { model, Schema } from 'mongoose'

export const countrySchema = () => {
  const names = {} as { [key in Locale]: { type: StringConstructor; required: true; trim: true; label: string } }
  const aliases = {} as { [key in Locale]: { type: { type: StringConstructor; trim: true }[]; label: string } }
  for (const locale of locales) {
    names[locale] = { type: String, required: true, trim: true, label: `languages.${locale}` }
    aliases[locale] = { type: [{ type: String, trim: true }], label: `languages.${locale}` }
  }

  return new Schema<Country>({
    _id: { type: String, required: true, trim: true, alias: 'code', label: 'labels.code' },
    flag: { type: String },
    name: { type: names, required: true },
    needsA1Certificate: { type: Boolean },
    alias: { type: aliases },
    lumpSumsFrom: { type: String, ref: 'Country', trim: true },
    currency: { type: String, ref: 'Currency' },
    lumpSums: {
      type: [
        {
          type: {
            validFrom: { type: Date },
            validUntil: { type: Date },
            catering24: { type: Number, label: 'lumpSums.catering24' },
            catering8: { type: Number, label: 'lumpSums.catering8' },
            overnight: { type: Number, label: 'lumpSums.overnight' },
            specials: {
              type: [
                {
                  type: {
                    city: { type: String, trim: true },
                    catering24: { type: Number, label: 'lumpSums.catering24' },
                    catering8: { type: Number, label: 'lumpSums.catering8' },
                    overnight: { type: Number, label: 'lumpSums.overnight' }
                  }
                }
              ]
            }
          }
        }
      ]
    }
  })
}

export default model('Country', countrySchema())
