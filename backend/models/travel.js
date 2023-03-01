const mongoose = require('mongoose')

const travelSchema = new mongoose.Schema({
  name: { type: String },
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  state: { type: String, required: true, enum: ['appliedFor', 'approved', 'underExamination', 'refunded'], default: 'appliedFor' },
  editor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  advance: {
    amount: { type: Number, min: 0, required: true },
    currency: { type: mongoose.Schema.Types.ObjectId, ref: 'Currency', required: true },
  },
  professionalShare: { type: Number, min: 0.5, max: 0.8 },
  claimOvernightLumpSum: { type: Boolean, required: true },
  history: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Travel' }],
  historic: {type: Boolean, required: true, default: false},
  records: [{
    type: { type: String, enum: ['route', 'stay'] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startLocation: { type: String },
    endLocation: { type: String },
    transport: { type: String, enum: ['ownCar', 'other'] },
    cost: {
      amount: { type: Number, min: 0, required: true },
      currency: { type: mongoose.Schema.Types.ObjectId, ref: 'Currency', required: true },
      receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'File' }
    },
    purpose: { type: String, enum: ['professional', 'mixed', 'private'] },
    cateringNoRefund: [{
      breakfast: { type: Boolean, default: false },
      lunch: { type: Boolean, default: false },
      dinner: { type: Boolean, default: false }
    }]
  }]
}, {timestamps: true})

travelSchema.pre(/^find((?!Update).)*$/, function () {
  this.populate({ path: 'advance.currency', model: 'Currency' })
  this.populate({ path: 'records.cost.currency', model: 'Currency' })
})

travelSchema.methods.saveToHistory = async function () {
  const doc = (await mongoose.model('Travel').findOne({ _id: this._id }, { history: 0 })).toObject()
  delete doc._id
  doc.historic = true
  const old = await mongoose.model('Travel').create(doc)
  this.history.push(old)
  this.markModified('history')
};

module.exports = mongoose.model('Travel', travelSchema)
