const mongoose = require('mongoose')
const settings = require('../settings')


const currencySchema = new mongoose.Schema({
  name: {
    de: { type: String, required: true, trim: true },
    en: { type: String, trim: true }
  },
  _id: { type: String, required: true, trim: true, alias: 'code' },
  subunit: { type: String, trim: true },
  symbol: { type: String, trim: true },
  flag: { type: String }
})

currencySchema.methods.convert = function (amount, to = settings.baseCurrency) {
  // To do
  return amount
},

module.exports = mongoose.model('Currency', currencySchema)
