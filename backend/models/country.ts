import { HydratedDocument, Model, Schema, model } from 'mongoose'
import settings from '../../common/settings.json' assert { type: 'json' }
import { Country, CountryLumpSum } from '../../common/types.js'

interface Methods {
  getLumpSum(date: Date): Promise<CountryLumpSum>
}

type CountryModel = Model<Country, {}, Methods>

const countrySchema = new Schema<Country, CountryModel, Methods>({
  name: {
    de: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true }
  },
  alias: {
    de: { type: String, trim: true },
    en: { type: String, trim: true }
  },
  _id: { type: String, required: true, trim: true, alias: 'code' },
  flag: { type: String },
  lumpSums: [
    {
      validFrom: { type: Date },
      catering24: { type: Number },
      catering8: { type: Number },
      overnight: { type: Number },
      spezials: [
        {
          city: { type: String, trim: true },
          catering24: { type: Number },
          catering8: { type: Number },
          overnight: { type: Number }
        }
      ]
    }
  ],
  lumpSumsFrom: { type: String, trim: true },
  currency: { type: String, ref: 'Currency' }
})

countrySchema.methods.getLumpSum = async function (date: Date): Promise<CountryLumpSum> {
  if (this.lumpSumsFrom) {
    return (await model('Country').findOne({ _id: this.lumpSumsFrom })).getLumpSum(date)
  } else if (this.lumpSums.length == 0) {
    return (await model('Country').findOne({ _id: settings.fallBackLumpSumCountry })).getLumpSum(date)
  } else {
    var nearest = 0
    for (var i = 0; i < this.lumpSums.length; i++) {
      var diff = date.valueOf() - this.lumpSums[i].validFrom.valueOf()
      if (diff >= 0 && diff < date.valueOf() - this.lumpSums[nearest].validFrom.valueOf()) {
        nearest = i
      }
    }
    if (date.valueOf() - this.lumpSums[nearest].validFrom.valueOf() < 0) {
      throw Error('No valid lumpSum found for Country: ' + this._id + ' for date: ' + date)
    }
    return this.lumpSums[nearest]
  }
}

export default model<Country, CountryModel>('Country', countrySchema)

export interface CountryDoc extends Methods, HydratedDocument<Country> {}
