const mongoose = require('mongoose')
const { getDayList, getDiffInDays } = require('../scripts')
const Country = require('./country')
const settings = require('../settings')


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
  days: [{
    date: { type: Date, required: true },
    country: { type: String, ref: 'Country', required: true },
    cateringNoRefund: {
      breakfast: { type: Boolean, default: false },
      lunch: { type: Boolean, default: false },
      dinner: { type: Boolean, default: false }
    },
    purpose: { type: String, enum: ['professional', 'private'], default: 'professional' },
    refunds: [{
      type: { type: String, enum: ['overnight', 'catering8', 'catering24', 'expense'], required: true },
      refund: {
        amount: { type: Number, min: 0 },
        currency: { type: String, ref: 'Currency' },
      }
    }]
  }],
}, { timestamps: true })

travelSchema.pre(/^find((?!Update).)*$/, function () {
  this.populate({ path: 'advance.currency', model: 'Currency' })
  this.populate({ path: 'records.cost.currency', model: 'Currency' })
  this.populate({ path: 'records.cost.receipts', model: 'File', select: { name: 1, type: 1 } })
  this.populate({ path: 'days.refunds.refund.currency', model: 'Currency' })
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

travelSchema.methods.calculateDays = function () {
  if (this.records.length > 0) {
    const days = getDayList(this.records[0].startDate, this.records[this.records.length - 1].endDate)
    const newDays = days.map((d) => { return { date: d } })
    for (const oldDay of this.days) {
      for (const newDay of newDays) {
        if (new Date(oldDay.date) - new Date(newDay.date) == 0) {
          newDay.cateringNoRefund = oldDay.cateringNoRefund
          newDay.purpose = oldDay.purpose
          break
        }
      }
    }
    this.days = newDays
  } else {
    this.days = []
  }
}

travelSchema.methods.getBorderCrossings = function () {
  if (this.records.length > 0) {
    const startCountry = this.records[0].startLocation ? this.records[0].startLocation.country : this.records[0].location.country
    const borderCrossings = [{ date: new Date(this.records[0].startDate), country: startCountry }]
    for (var i = 0; i < this.records.length; i++) {
      const record = this.records[i]
      // Country Change
      if (record.type == 'route' && record.startLocation && record.endLocation && record.startLocation.country !== record.endLocation.country) {
        // More than 1 night
        if (getDiffInDays(record.startDate, record.endDate) > 1) {
          if (['ownCar', 'otherTransport'].indexOf(record.transport) !== -1) {
            borderCrossings.push(...record.midnightCountries)
          } else if (record.transport = 'airplane') {
            borderCrossings.push({ date: new Date(new Date(record.startDate).valueOf() + 24 * 60 * 60 * 1000), country: settings.secoundNightOnAirplaneLumpSumCountry })
          } else if (record.transport = 'shipOrFerry') {
            borderCrossings.push({ date: new Date(new Date(record.startDate).valueOf() + 24 * 60 * 60 * 1000), country: settings.secoundNightOnShipOrFerryLumpSumCountry })
          }
        }
        borderCrossings.push({ date: new Date(record.endDate), country: record.endLocation.country })
      }
    }
    return borderCrossings
  } else {
    return []
  }
}

travelSchema.methods.addCountriesToDays = async function () {
  const borderCrossings = this.getBorderCrossings()
  for (const borderX of borderCrossings) {
    borderX.country = await Country.findOne({ _id: borderX.country })
  }
  var bXIndex = 0
  for (const day of this.days) {
    if (bXIndex < borderCrossings.length - 1 &&
      (day.date.valueOf() + 1000 * 24 * 60 * 60 - 1) - borderCrossings[bXIndex + 1].date.valueOf() > 0) {
      bXIndex++
    }
    day.country = borderCrossings[bXIndex].country
  }
}

travelSchema.methods.addCateringRefunds = async function () {
  for (var i = 0; i < this.days.length; i++) {
    const day = this.days[i]
    if (day.purpose == 'professional') {
      const result = { type: 'catering24' }
      if (i == 0 || i == this.days.length - 1) {
        result.type = 'catering8'
      }
      var amount = (await day.country.getLumpSum(day.date))[result.type]
      var leftover = 1
      if (day.cateringNoRefund.breakfast) leftover -= settings.breakfastCateringLumpSumCut
      if (day.cateringNoRefund.lunch) leftover -= settings.lunchCateringLumpSumCut
      if (day.cateringNoRefund.dinner) leftover -= settings.dinnerCateringLumpSumCut

      result.refund = { amount: Math.round(amount * leftover * settings.factorCateringLumpSum * 100) / 100, currency: 'EUR' }
      day.refunds.push(result)
    }
  }
}

travelSchema.methods.addOvernightRefunds = async function () {
  if (this.claimOvernightLumpSum) {
    var recordIndex = 0
    for (var i = 0; i < this.days.length; i++) {
      const day = this.days[i]
      if (day.purpose == 'professional') {
        if (i == this.days.length - 1) {
          break
        }
        var midnight = day.date.valueOf() + 1000 * 24 * 60 * 60 - 1
        while (recordIndex < this.records.length && this.records[recordIndex].type != 'route' && midnight - new Date(this.records[recordIndex].endDate).valueOf() > 0) {
          recordIndex++
        }
        if (midnight - new Date(this.records[recordIndex].startDate).valueOf() > 0 &&
          new Date(this.records[recordIndex].endDate).valueOf() - midnight > 0) {
          continue
        }
        const result = { type: 'overnight' }
        var amount = (await day.country.getLumpSum(day.date))[result.type]
        result.refund = { amount: Math.round(amount * settings.factorOvernightLumpSum * 100) / 100, currency: 'EUR' }
        day.refunds.push(result)
      }
    }
  }

}



travelSchema.pre('save', async function (next) {
  this.calculateDays()
  await this.addCountriesToDays()
  await this.addCateringRefunds()
  await this.addOvernightRefunds()
  next();
});

module.exports = mongoose.model('Travel', travelSchema)
