const mongoose = require('mongoose')

const currencySchema = new mongoose.Schema({
  name: {
    de: { type: String, required: true, trim: true },
    en: { type: String, trim: true }
  },
  code: { type: String, required: true, unique: true, index: true, trim: true },
  subunit: { type: String, trim: true }
})


module.exports = mongoose.model('Currency', currencySchema)
