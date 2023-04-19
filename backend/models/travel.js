const mongoose = require('mongoose')
const { getDayList, getDiffInDays } = require('../scripts')

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
    midnightCountries: [{ date: { type: Date, required: true }, country: { type: String, ref: 'Country' } }],
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
    country: { type: String, ref: 'Country' },
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
  this.populate({ path: 'refunds.refund.currency', model: 'Currency' })
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
    const days = getDayList(this.records[0].startDate, this.records[this.records.length - 1].endDate)
    for (const day of days) {
      newCateringNoRefund.push({
        date: day
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

travelSchema.methods.getBorderCrossings = function () {
  if (this.records.length > 0) {
    const startCountry = this.records[0].startLocation ? this.records[0].startLocation.country : this.records[0].location.country
    const borderCrossings = [{date: new Date(this.records[0].startDate), country: startCountry}]
    for (var i = 1; i < this.records.length; i++) {
      const record = this.records[i]
      // Country Change
      if(record.type == 'route' && record.startLocation && record.endLocation && record.startLocation.country !== record.endLocation.country){
        // More than 1 night
        if(getDiffInDays(record.startDate, record.endDate) > 1){
          if(['ownCar', 'otherTransport'].indexOf(record.transport) !== -1){
            borderCrossings.push(...record.midnightCountries)
          }else if(record.transport = 'airplane'){
            borderCrossings.push({date: new Date(new Date(record.startDate).valueOf() + 24 * 60 * 60 * 1000), country: 'AT'})
          }else if(record.transport = 'shipOrFerry'){
            borderCrossings.push({date: new Date(new Date(record.startDate).valueOf() + 24 * 60 * 60 * 1000), country: 'LU'})
          }
        }
        borderCrossings.push({date: new Date(record.endDate), country: record.endLocation.country})
      }
    }
    return borderCrossings
  }else{
    return []
  }
}

travelSchema.methods.calculateRefunds = async function () {
  if (this.records.length > 0) {
    const borderCrossings = this.getBorderCrossings()
    console.log(borderCrossings)

    const days = getDayList(this.records[0].startDate, this.records[this.records.length - 1].endDate)
    const catering = []
    for(var i = 0; i < days.length; i++){
      var type = 'catering24'
      if( i == 0 || i == days.length - 1){
        type = 'catering8'
      }
      catering.push({type: type, date: days[i]})
    }
    
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
