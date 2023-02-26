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
  code: { type: String, required: true, unique: true, index: true, trim: true },
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
  currency: {type: mongoose.Schema.Types.ObjectId, ref: 'Currency'}
})

countrySchema.pre(/^find((?!Update).)*$/, function () {
  this.populate({ path: 'name' })
  this.populate({ path: 'lumpSums' })
  this.populate({ path: 'lumpSums.spezials' })
})

module.exports = mongoose.model('Country', countrySchema)
