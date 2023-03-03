const mongoose = require('mongoose')

const countrySchema = new mongoose.Schema({
  name: {
    de: { type: String, required: true, trim: true },
    en: { type: String, trim: true }
  },
  alias: {
    de: { type: String, trim: true },
    en: { type: String, trim: true }
  },
  _id: { type: String, required: true, trim: true, alias: 'code' },
  flag: { type: String },
  lumpSums: [{
    validFrom: { type: Date },
    catering24: { type: Number },
    catering8: { type: Number },
    overnight: { type: Number },
    spezials: [{
      city: { type: String, trim: true },
      catering24: { type: Number },
      catering8: { type: Number },
      overnight: { type: Number },
    }]
  }],
  lumpSumsFrom: { type: String, trim: true },
  currency: {type: String, ref: 'Currency'}
})

module.exports = mongoose.model('Country', countrySchema)
