import { Schema, Document, Model, model } from 'mongoose'
import { getDayList, getDiffInDays } from '../../common/scripts.js'
import Country from './country.js'
import Currency from './currency.js'
import settings from '../../common/settings.json' assert { type: 'json' }
import { convertCurrency } from '../helper.js'
import { Money, Record, Refund, Travel, TravelDay, Currency as ICurrency } from '../../common/types.js'

function place(required = false) {
  return {
    country: { type: String, ref: 'Country', required: required },
    place: { type: String, required: required }
  }
}

function costObject(exchangeRate = true, receipts = true, required = false, defaultCurrency: string | null = null) {
  const costObject: any = {
    amount: { type: Number, min: 0, required: required, default: null },
    currency: { type: String, ref: 'Currency', required: required, default: defaultCurrency }
  }
  if (exchangeRate) {
    costObject.exchangeRate = {
      date: { type: Date },
      rate: { type: Number, min: 0 },
      amount: { type: Number, min: 0 }
    }
  }
  if (receipts) {
    costObject.receipts = [{ type: Schema.Types.ObjectId, ref: 'DocumentFile', required: required }]
    costObject.date = { type: Date, required: required }
  }
  return costObject
}

interface Methods {
  saveToHistory(): Promise<void>
  calculateProgress(): void
  calculateDays(): void
  getBorderCrossings(): Promise<{ date: Date; country: any }[]>
  addCountriesToDays(): Promise<void>
  addCateringRefunds(): Promise<void>
  addOvernightRefunds(): Promise<void>
  calculateExchangeRates(): Promise<void>
  calculateProfessionalShare(): void
  calculateRefundforOwnCar(): void
  addComment(): void
}

type TravelModel = Model<Travel, {}, Methods>

const travelSchema = new Schema<Travel, TravelModel, Methods>(
  {
    name: { type: String },
    traveler: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    state: {
      type: String,
      required: true,
      enum: ['rejected', 'appliedFor', 'approved', 'underExamination', 'refunded'],
      default: 'appliedFor'
    },
    editor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comments: [
      {
        text: { type: String },
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        toState: {
          type: String,
          required: true,
          enum: ['rejected', 'appliedFor', 'approved', 'underExamination', 'refunded']
        }
      }
    ],
    reason: { type: String, required: true },
    destinationPlace: place(true),
    travelInsideOfEU: { type: Boolean, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    advance: costObject(true, false, false, 'EUR'),
    professionalShare: { type: Number, min: 0, max: 1 },
    claimOvernightLumpSum: { type: Boolean, default: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    history: [{ type: Schema.Types.ObjectId, ref: 'Travel' }],
    historic: { type: Boolean, required: true, default: false },
    stages: [
      {
        departure: { type: Date, required: true },
        arrival: { type: Date, required: true },
        startLocation: place(true),
        endLocation: place(true),
        midnightCountries: [{ date: { type: Date, required: true }, country: { type: String, ref: 'Country' } }],
        distance: { type: Number, min: 0 },
        transport: { type: String, enum: ['ownCar', 'airplane', 'shipOrFerry', 'otherTransport'], required: true },
        cost: costObject(true, true),
        purpose: { type: String, enum: ['professional', 'mixed', 'private'] }
      }
    ],
    expenses: [
      {
        description: { type: String, required: true },
        cost: costObject(true, true, true),
        purpose: { type: String, enum: ['professional', 'mixed'] }
      }
    ],
    days: [
      {
        date: { type: Date, required: true },
        country: { type: String, ref: 'Country', required: true },
        cateringNoRefund: {
          breakfast: { type: Boolean, default: false },
          lunch: { type: Boolean, default: false },
          dinner: { type: Boolean, default: false }
        },
        purpose: { type: String, enum: ['professional', 'private'], default: 'professional' },
        refunds: [
          {
            type: { type: String, enum: ['overnight', 'catering8', 'catering24'], required: true },
            refund: costObject(true, false, true)
          }
        ]
      }
    ]
  },
  { timestamps: true }
)

if (settings.allowSpouseRefund) {
  travelSchema.add({ claimSpouseRefund: { type: Boolean, default: false }, fellowTravelersNames: { type: String } })
}

function populate(doc: Document) {
  return Promise.allSettled([
    doc.populate({ path: 'advance.currency' }),
    doc.populate({ path: 'stages.cost.currency' }),
    doc.populate({ path: 'expenses.cost.currency' }),
    doc.populate({ path: 'days.refunds.refund.currency' }),
    doc.populate({ path: 'destinationPlace.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.startLocation.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.endLocation.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.midnightCountries.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'days.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'traveler', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'editor', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'comments.author', select: { name: 1, email: 1 } })
  ])
}

travelSchema.pre(/^find((?!Update).)*$/, function () {
  populate(this as Document)
})

travelSchema.pre('deleteOne', { document: true, query: false }, function () {
  for (const historyId of this.history) {
    model('Travel').deleteOne({ _id: historyId }).exec()
  }
  function deleteReceipts(records: Record[]) {
    for (const record of records) {
      if (record.cost) {
        for (const receipt of record.cost.receipts) {
          model('DocumentFile').deleteOne({ _id: receipt._id }).exec()
        }
      }
    }
  }
  deleteReceipts(this.stages)
  deleteReceipts(this.expenses)
})

travelSchema.methods.saveToHistory = async function () {
  const doc = (await model('Travel').findOne({ _id: this._id }, { history: 0 })).toObject()
  delete doc._id
  doc.historic = true
  const old = await model('Travel').create(doc)
  this.history.push(old)
  this.markModified('history')
}

travelSchema.methods.calculateProgress = function () {
  if (this.stages.length > 0) {
    var approvedLength = getDiffInDays(this.startDate, this.endDate) + 1
    var stageLength = getDiffInDays(this.stages[0].departure, this.stages[this.stages.length - 1].arrival) + 1
    if (stageLength >= approvedLength) {
      this.progress = 100
    } else {
      this.progress = Math.round((stageLength / approvedLength) * 100)
    }
  } else {
    this.progress = 0
  }
}

travelSchema.methods.calculateDays = function () {
  if (this.stages.length > 0) {
    const days = getDayList(this.stages[0].departure, this.stages[this.stages.length - 1].arrival)
    const newDays: Partial<TravelDay>[] = days.map((d) => {
      return { date: d }
    })
    for (const oldDay of this.days) {
      for (const newDay of newDays) {
        if (new Date(oldDay.date).valueOf() - new Date(newDay.date!).valueOf() == 0) {
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

travelSchema.methods.getBorderCrossings = async function (): Promise<{ date: Date; country: any }[]> {
  if (this.stages.length > 0) {
    const startCountry = this.stages[0].startLocation.country
    const borderCrossings = [{ date: new Date(this.stages[0].departure), country: startCountry }]
    for (var i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i]
      // Country Change
      if (stage.startLocation && stage.endLocation && stage.startLocation.country._id != stage.endLocation.country._id) {
        // More than 1 night
        if (getDiffInDays(stage.departure, stage.arrival) > 1) {
          if (['ownCar', 'otherTransport'].indexOf(stage.transport) !== -1) {
            borderCrossings.push(...stage.midnightCountries)
          } else if ((stage.transport = 'airplane')) {
            borderCrossings.push({
              date: new Date(new Date(stage.departure).valueOf() + 24 * 60 * 60 * 1000),
              country: await Country.findOne({ _id: settings.secoundNightOnAirplaneLumpSumCountry })
            })
          } else if ((stage.transport = 'shipOrFerry')) {
            borderCrossings.push({
              date: new Date(new Date(stage.departure).valueOf() + 24 * 60 * 60 * 1000),
              country: await Country.findOne({ _id: settings.secoundNightOnShipOrFerryLumpSumCountry })
            })
          }
        }
        borderCrossings.push({ date: new Date(stage.arrival), country: stage.endLocation.country })
      }
    }
    return borderCrossings
  } else {
    return []
  }
}

travelSchema.methods.addCountriesToDays = async function () {
  const borderCrossings = await this.getBorderCrossings()
  for (const borderX of borderCrossings) {
    borderX.country = await Country.findOne({ _id: borderX.country._id })
  }
  var bXIndex = 0
  for (const day of this.days) {
    while (
      bXIndex < borderCrossings.length - 1 &&
      day.date.valueOf() + 1000 * 24 * 60 * 60 - 1 - borderCrossings[bXIndex + 1].date.valueOf() > 0
    ) {
      bXIndex++
    }
    day.country = borderCrossings[bXIndex].country
  }
}

travelSchema.methods.addCateringRefunds = async function () {
  for (var i = 0; i < this.days.length; i++) {
    const day = this.days[i]
    if (day.purpose == 'professional') {
      const result: Partial<Refund> = { type: 'catering24' }
      if (i == 0 || i == this.days.length - 1) {
        result.type = 'catering8'
      }
      var amount = (await day.country.getLumpSum(day.date))[result.type!]
      var leftover = 1
      if (day.cateringNoRefund.breakfast) leftover -= settings.breakfastCateringLumpSumCut
      if (day.cateringNoRefund.lunch) leftover -= settings.lunchCateringLumpSumCut
      if (day.cateringNoRefund.dinner) leftover -= settings.dinnerCateringLumpSumCut

      result.refund = {
        amount:
          Math.round(
            amount *
              leftover *
              ((settings.factorCateringLumpSumExceptions as string[]).indexOf(day.country._id) == -1 ? settings.factorCateringLumpSum : 1) *
              100
          ) / 100,
        currency: settings.baseCurrency
      }
      if (settings.allowSpouseRefund && this.claimSpouseRefund) {
        result.refund.amount! *= 2
      }
      day.refunds.push(result)
    }
  }
}

travelSchema.methods.addOvernightRefunds = async function () {
  if (this.claimOvernightLumpSum) {
    var stageIndex = 0
    for (var i = 0; i < this.days.length; i++) {
      const day = this.days[i]
      if (day.purpose == 'professional') {
        if (i == this.days.length - 1) {
          break
        }
        var midnight = day.date.valueOf() + 1000 * 24 * 60 * 60 - 1
        while (stageIndex < this.stages.length - 1 && midnight - new Date(this.stages[stageIndex].arrival).valueOf() > 0) {
          stageIndex++
        }
        if (
          midnight - new Date(this.stages[stageIndex].departure).valueOf() > 0 &&
          new Date(this.stages[stageIndex].arrival).valueOf() - midnight > 0
        ) {
          continue
        }
        const result: Partial<Refund> = { type: 'overnight' }
        var amount = (await day.country.getLumpSum(day.date))[result.type!]
        result.refund = {
          amount:
            Math.round(
              amount *
                (settings.factorOvernightLumpSumExceptions.indexOf(day.country._id) == -1 ? settings.factorOvernightLumpSum : 1) *
                100
            ) / 100,
          currency: settings.baseCurrency
        }
        if (settings.allowSpouseRefund && this.claimSpouseRefund) {
          result.refund.amount! *= 2
        }
        day.refunds.push(result)
      }
    }
  }
}

async function exchange(costObject: Money, date: string | number | Date) {
  var exchangeRate = null

  if (costObject.amount !== null && costObject.amount > 0 && (costObject.currency as ICurrency)._id !== settings.baseCurrency._id) {
    exchangeRate = await convertCurrency(date, costObject.amount!, (costObject.currency as ICurrency)._id)
  }
  costObject.exchangeRate = exchangeRate

  return costObject
}

travelSchema.methods.calculateExchangeRates = async function () {
  const promiseList = []
  promiseList.push(exchange(this.advance, this.createdAt ? this.createdAt : new Date()))
  for (const stage of this.stages) {
    promiseList.push(exchange(stage.cost, stage.cost.date))
  }
  for (const expense of this.expenses) {
    promiseList.push(exchange(expense.cost, expense.cost.date))
  }
  const results = await Promise.allSettled(promiseList)
  if (results[0].status === 'fulfilled') {
    this.advance = results[0].value
  }
  var i = 1
  for (const stage of this.stages) {
    if (results[i].status === 'fulfilled') {
      stage.cost = (results[i] as PromiseFulfilledResult<Money>).value
    }
    i++
  }
  for (const expense of this.expenses) {
    if (results[i].status === 'fulfilled') {
      expense.cost = (results[i] as PromiseFulfilledResult<Money>).value
    }
    i++
  }
}

travelSchema.methods.calculateProfessionalShare = function () {
  if (this.days.length > 0) {
    var professionalDays = 0
    for (const day of this.days) {
      if (day.purpose === 'professional') {
        professionalDays += 1
      }
    }
    this.professionalShare = professionalDays / this.days.length
  } else {
    this.professionalShare = null
  }
}

travelSchema.methods.calculateRefundforOwnCar = function () {
  for (const stage of this.stages) {
    if (stage.transport === 'ownCar') {
      stage.cost = Object.assign(stage.cost, {
        amount: Math.round(stage.distance * settings.refundPerKM * 100) / 100,
        currency: settings.baseCurrency
      })
    }
  }
}

travelSchema.methods.addComment = function () {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state })
    delete this.comment
  }
}

travelSchema.pre('validate', function () {
  this.addComment()
})

travelSchema.pre('save', async function (next) {
  await populate(this)
  this.calculateProgress()
  this.calculateDays()
  this.calculateProfessionalShare()
  this.calculateRefundforOwnCar()
  await this.addCountriesToDays()
  await this.addCateringRefunds()
  await this.addOvernightRefunds()

  await this.calculateExchangeRates()
  next()
})

export default model<Travel, TravelModel>('Travel', travelSchema)
