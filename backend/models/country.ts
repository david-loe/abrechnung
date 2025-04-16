import { Schema, model } from 'mongoose'
import { Country } from '../../common/types.js'

export const countrySchema = () =>
  new Schema<Country>({
    _id: { type: String, required: true, trim: true, alias: 'code', label: 'labels.code' },
    flag: { type: String },
    name: {
      type: {
        de: { type: String, required: true, trim: true },
        en: { type: String, required: true, trim: true }
      },
      required: true
    },
    needsA1Certificate: { type: Boolean },
    alias: {
      type: {
        de: { type: [{ type: String, trim: true }] },
        en: { type: [{ type: String, trim: true }] }
      }
    },
    lumpSumsFrom: { type: String, ref: 'Country', trim: true },
    currency: { type: String, ref: 'Currency' },
    lumpSums: {
      type: [
        {
          validFrom: { type: Date },
          catering24: { type: Number, label: 'lumpSums.catering24' },
          catering8: { type: Number, label: 'lumpSums.catering8' },
          overnight: { type: Number, label: 'lumpSums.overnight' },
          specials: {
            type: [
              {
                city: { type: String, trim: true },
                catering24: { type: Number, label: 'lumpSums.catering24' },
                catering8: { type: Number, label: 'lumpSums.catering8' },
                overnight: { type: Number, label: 'lumpSums.overnight' }
              }
            ]
          }
        }
      ]
    }
  })

export default model('Country', countrySchema())
