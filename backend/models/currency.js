const mongoose = require('mongoose')

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

module.exports = mongoose.model('Currency', currencySchema)
