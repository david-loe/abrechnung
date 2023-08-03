const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, index: true },
  email: { type: String },
  name: { type: String },
  access: {
    examine: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
    admin: { type: Boolean, default: false }
  },
  settings: {
    language: { type: String, default: 'de' },
    lastCurrencies: [{ type: String, ref: 'Currency' }],
    lastCountries: [{ type: String, ref: 'Country' }]
  },
  vehicleRegistration: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DocumentFile' }]
})

function populate(doc) {
  return Promise.allSettled([
    doc.populate({ path: 'settings.lastCurrencies', model: 'Currency' }),
    doc.populate({ path: 'settings.lastCountries', model: 'Country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'vehicleRegistration', model: 'DocumentFile', select: { name: 1, type: 1 } })
  ])
}

userSchema.pre(/^find((?!Update).)*$/, function () {
  populate(this)
})

userSchema.pre('save', async function (next) {
  await populate(this)
  next();
})

module.exports = mongoose.model('User', userSchema)
