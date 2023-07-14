const mongoose = require('mongoose')
const settings = require('../common/settings')


const countrySchema = new mongoose.Schema({
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
  currency: { type: String, ref: 'Currency' }
})

countrySchema.methods.getLumpSum = async function (date) {
  if (this.lumpSumsFrom) {
    return (await mongoose.model('Country').findOne({ _id: this.lumpSumsFrom })).getLumpSum(date)
  } else if (this.lumpSums.length == 0) {
    return (await mongoose.model('Country').findOne({ _id: settings.fallBackLumpSumCountry })).getLumpSum(date)
  } else {
    var nearest = 0;
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

module.exports = mongoose.model('Country', countrySchema)
