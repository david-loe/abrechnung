const mongoose = require('mongoose')

const place = {
  country: { type: String, ref: 'Country' },
  place: { type: String }
}

const travelSchema = new mongoose.Schema({
  name: { type: String },
  traveler: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  state: { type: String, required: true, enum: ['rejected', 'appliedFor', 'approved', 'underExamination', 'refunded'], default: 'appliedFor' },
  editor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comment: { type: String },
  reason: { type: String, required: true },
  destinationPlace: place,
  travelInsideOfEU: { type: Boolean, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  advance: {
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, ref: 'Currency', required: true },
  },
  professionalShare: { type: Number, min: 0.5, max: 0.8 },
  claimOvernightLumpSum: { type: Boolean, default: true },
  history: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Travel' }],
  historic: { type: Boolean, required: true, default: false },
  records: [{
    type: { type: String, enum: ['route', 'stay'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startLocation: place,
    endLocation: place,
    distance: { type: Number, min: 0 },
    location: place,
    transport: { type: String, enum: ['ownCar', 'airplane', 'shipOrFerry', 'otherTransport'] },
    cost: {
      amount: { type: Number, min: 0 },
      currency: { type: String, ref: 'Currency' },
      receipts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }]
    },
    purpose: { type: String, enum: ['professional', 'mixed', 'private'] },
  }],
  cateringNoRefund: [{
    date: { type: Date, required: true },
    breakfast: { type: Boolean, default: false },
    lunch: { type: Boolean, default: false },
    dinner: { type: Boolean, default: false }
  }],
  refunds: [{
    type: { type: String, enum: ['overnight', 'catering8', 'catering24', 'expense'], required: true },
    date: { type: Date, required: true },
    refund: {
      amount: { type: Number, min: 0 },
      currency: { type: String, ref: 'Currency' },
    },
    recordIndex: { type: Number, min: 0 }
  }]
}, { timestamps: true })

travelSchema.pre(/^find((?!Update).)*$/, function () {
  this.populate({ path: 'advance.currency', model: 'Currency' })
  this.populate({ path: 'records.cost.currency', model: 'Currency' })
  this.populate({ path: 'records.cost.receipts', model: 'File', select: { name: 1, type: 1 } })
  this.populate({ path: 'traveler', model: 'User', select: { name: 1, email: 1 } })
  this.populate({ path: 'editor', model: 'User', select: { name: 1, email: 1 } })
})

travelSchema.methods.saveToHistory = async function () {
  const doc = (await mongoose.model('Travel').findOne({ _id: this._id }, { history: 0 })).toObject()
  delete doc._id
  doc.historic = true
  const old = await mongoose.model('Travel').create(doc)
  this.history.push(old)
  this.comment = null
  this.markModified('history')
};

travelSchema.methods.calculateCateringNoRefund = function () {
  if (this.records.length > 0) {
    const oldCateringNoRefund = JSON.parse(JSON.stringify(this.cateringNoRefund))
    const newCateringNoRefund = []
    const firstDay = new Date(this.records[0].startDate.toISOString().slice(0, -14))
    const lastDay = new Date(this.records[this.records.length - 1].endDate.toISOString().slice(0, -14))
    const dayCount = ((lastDay.valueOf() - firstDay.valueOf()) / (1000 * 60 * 60 * 24)) + 1
    for (var i = 0; i < dayCount; i++) {
      newCateringNoRefund.push({
        date: new Date(firstDay.valueOf() + i * 1000 * 60 * 60 * 24)
      })
    }
    for (const oldCNR of oldCateringNoRefund) {
      for (const newCNR of newCateringNoRefund) {
        if (new Date(oldCNR.date) - new Date(newCNR.date) == 0) {
          Object.assign(newCNR, oldCNR)
          break
        }
      }
    }
    this.cateringNoRefund = newCateringNoRefund
  } else {
    this.cateringNoRefund = []
  }
}

travelSchema.methods.calculateRefunds = async function () {
  if (this.records.length > 0) {
  } else {
    this.refunds = []
  }
}

travelSchema.pre('save', async function (next) {
  this.calculateCateringNoRefund()
  await this.calculateRefunds()
  next();
});

module.exports = mongoose.model('Travel', travelSchema)
