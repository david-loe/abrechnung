import { Schema, Document, Model, model, HydratedDocument, Error } from 'mongoose'
import { datetimeToDate, getDayList, getDiffInDays } from '../../common/scripts.js'
import Country, { CountryDoc } from './country.js'
import Settings from './settings.js'
import { convertCurrency, costObject } from '../helper.js'
import {
  Money,
  Record,
  Refund,
  Travel,
  TravelDay,
  Currency as ICurrency,
  CountrySimple,
  Meal,
  PurposeSimple,
  TravelComment,
  transportTypes,
  travelStates,
  lumpsumTypes,
  distanceRefundTypes,
  Place
} from '../../common/types.js'

const settings = (await Settings.findOne().lean())!

function place(required = false, withPlace = true) {
  const obj: any = {
    country: { type: String, ref: 'Country', required: required },
    special: { type: String }
  }
  if (withPlace) {
    obj['place'] = { type: String, required: required }
  }
  return obj
}

interface Methods {
  saveToHistory(): Promise<void>
  calculateProgress(): void
  getDays(): { date: Date; cateringNoRefund?: { [key in Meal]: boolean }; purpose?: PurposeSimple; refunds: Refund[] }[]
  getBorderCrossings(): Promise<{ date: Date; country: CountrySimple; special?: string }[]>
  getDateOfLastPlaceOfWork(): Date | null
  calculateDays(): Promise<void>
  addCateringRefunds(): Promise<void>
  addOvernightRefunds(): Promise<void>
  calculateExchangeRates(): Promise<void>
  calculateProfessionalShare(): void
  calculateRefundforOwnCar(): void
  addComment(): void
  validateDates(): void
  validateCountries(): void
}

type TravelModel = Model<Travel, {}, Methods>

const travelSchema = new Schema<Travel, TravelModel, Methods>(
  {
    name: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
    state: {
      type: String,
      required: true,
      enum: travelStates,
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
          enum: travelStates
        }
      }
    ],
    reason: { type: String, required: true },
    destinationPlace: place(true),
    travelInsideOfEU: { type: Boolean, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    advance: costObject(true, false, false, settings.baseCurrency._id),
    professionalShare: { type: Number, min: 0, max: 1 },
    claimOvernightLumpSum: { type: Boolean, default: true },
    lastPlaceOfWork: place(true, false),
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
        transport: {
          distance: { type: Number, min: 0 },
          distanceRefundType: { type: String, enum: distanceRefundTypes, default: distanceRefundTypes[0] },
          type: { type: String, enum: transportTypes, required: true }
        },
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
        special: { type: String },
        cateringNoRefund: {
          breakfast: { type: Boolean, default: false },
          lunch: { type: Boolean, default: false },
          dinner: { type: Boolean, default: false }
        },
        purpose: { type: String, enum: ['professional', 'private'], default: 'professional' },
        refunds: [
          {
            type: { type: String, enum: lumpsumTypes, required: true },
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
    doc.populate({ path: 'organisation', select: { name: 1 } }),
    doc.populate({ path: 'destinationPlace.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'lastPlaceOfWork.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.startLocation.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.endLocation.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.midnightCountries.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'days.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'owner', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'editor', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'comments.author', select: { name: 1, email: 1 } })
  ])
}

travelSchema.pre(/^find((?!Update).)*$/, function (this: TravelDoc) {
  populate(this)
})

travelSchema.pre('deleteOne', { document: true, query: false }, function (this: TravelDoc) {
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

travelSchema.methods.saveToHistory = async function (this: TravelDoc) {
  const doc: any = await model<Travel, TravelModel>('Travel').findOne({ _id: this._id }, { history: 0 }).lean()
  delete doc._id
  doc.historic = true
  const old = await model('Travel').create(doc)
  this.history.push(old)
  this.markModified('history')
}

travelSchema.methods.calculateProgress = function (this: TravelDoc) {
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

travelSchema.methods.getDays = function (this: TravelDoc) {
  if (this.stages.length > 0) {
    const days = getDayList(this.stages[0].departure, this.stages[this.stages.length - 1].arrival)
    const newDays: { date: Date; cateringNoRefund?: { [key in Meal]: boolean }; purpose?: PurposeSimple; refunds: Refund[] }[] = days.map(
      (d) => {
        return { date: d, refunds: [] }
      }
    )
    for (const oldDay of this.days) {
      for (const newDay of newDays) {
        if (new Date(oldDay.date).valueOf() - new Date(newDay.date!).valueOf() == 0) {
          newDay.cateringNoRefund = oldDay.cateringNoRefund
          newDay.purpose = oldDay.purpose
          break
        }
      }
    }
    return newDays
  } else {
    return []
  }
}

travelSchema.methods.getBorderCrossings = async function (
  this: TravelDoc
): Promise<{ date: Date; country: CountrySimple; special?: string }[]> {
  if (this.stages.length > 0) {
    const startCountry = this.stages[0].startLocation.country
    const borderCrossings: { date: Date; country: CountrySimple; special?: string }[] = [
      { date: new Date(this.stages[0].departure), country: startCountry }
    ]
    for (var i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i]
      // Country Change (or special change)
      if (
        stage.startLocation &&
        stage.endLocation &&
        (stage.startLocation.country._id !== stage.endLocation.country._id || stage.startLocation.special !== stage.endLocation.special)
      ) {
        // More than 1 night
        if (getDiffInDays(stage.departure, stage.arrival) > 1) {
          if (['ownCar', 'otherTransport'].indexOf(stage.transport.type) !== -1) {
            if (stage.midnightCountries) borderCrossings.push(...(stage.midnightCountries as { date: Date; country: CountrySimple }[]))
          } else if (stage.transport.type === 'airplane') {
            const country = await Country.findOne({ _id: settings.secoundNightOnAirplaneLumpSumCountry }).lean()
            if (country) {
              borderCrossings.push({
                date: new Date(new Date(stage.departure).valueOf() + 24 * 60 * 60 * 1000),
                country
              })
            } else {
              throw new Error('secoundNightOnAirplaneLumpSumCountry(' + settings.secoundNightOnAirplaneLumpSumCountry + ') not found')
            }
          } else if (stage.transport.type === 'shipOrFerry') {
            const country = await Country.findOne({ _id: settings.secoundNightOnShipOrFerryLumpSumCountry }).lean()
            if (country) {
              borderCrossings.push({
                date: new Date(new Date(stage.departure).valueOf() + 24 * 60 * 60 * 1000),
                country
              })
            } else {
              throw new Error('secoundNightOnShipOrFerryLumpSumCountry(' + settings.secoundNightOnShipOrFerryLumpSumCountry + ') not found')
            }
          }
        }
        borderCrossings.push({ date: new Date(stage.arrival), country: stage.endLocation.country, special: stage.endLocation.special })
      }
    }
    return borderCrossings
  } else {
    return []
  }
}

travelSchema.methods.getDateOfLastPlaceOfWork = function (this: TravelDoc) {
  var date: Date | null = null
  function sameCountryAndSpecial(placeA: Place, placeB: Place): boolean {
    return placeA.country._id === placeB.country._id && placeA.special === placeB.special
  }
  for (var i = this.stages.length - 1; i >= 0; i--) {
    if (sameCountryAndSpecial(this.stages[i].endLocation, this.lastPlaceOfWork)) {
      date = datetimeToDate(this.stages[i].arrival)
      break
    } else if (sameCountryAndSpecial(this.stages[i].startLocation, this.lastPlaceOfWork)) {
      date = datetimeToDate(this.stages[i].departure)
      break
    }
  }
  return date
}

travelSchema.methods.calculateDays = async function (this: TravelDoc) {
  const borderCrossings = await this.getBorderCrossings()
  const days = this.getDays()
  for (const borderX of borderCrossings) {
    const dbCountry = await Country.findOne({ _id: borderX.country._id })
    if (dbCountry) {
      borderX.country = dbCountry
    } else {
      throw new Error('No Country found with _id: ' + borderX.country._id)
    }
  }
  var bXIndex = 0
  for (const day of days) {
    while (
      bXIndex < borderCrossings.length - 1 &&
      day.date.valueOf() + 1000 * 24 * 60 * 60 - 1 - borderCrossings[bXIndex + 1].date.valueOf() > 0
    ) {
      bXIndex++
    }
    ;(day as Partial<TravelDay>).country = borderCrossings[bXIndex].country
    ;(day as Partial<TravelDay>).special = borderCrossings[bXIndex].special
  }

  // change days according to last place of work
  const dateOfLastPlaceOfWork = this.getDateOfLastPlaceOfWork()

  if (dateOfLastPlaceOfWork) {
    const dbCountry = await Country.findOne({ _id: this.lastPlaceOfWork.country._id })
    if (!dbCountry) {
      throw new Error('No Country found with _id: ' + this.lastPlaceOfWork.country._id)
    }
    for (const day of days) {
      if (day.date.valueOf() >= dateOfLastPlaceOfWork.valueOf()) {
        ;(day as Partial<TravelDay>).country = dbCountry
        ;(day as Partial<TravelDay>).special = this.lastPlaceOfWork.special
      }
    }
  }

  this.days = days as TravelDay[]
}

travelSchema.methods.addCateringRefunds = async function (this: TravelDoc) {
  for (var i = 0; i < this.days.length; i++) {
    const day = this.days[i]
    if (day.purpose == 'professional') {
      const result: Partial<Refund> = { type: 'catering24' }
      if (i == 0 || i == this.days.length - 1) {
        result.type = 'catering8'
      }
      var amount = (await (day.country as CountryDoc).getLumpSum(day.date as Date, day.special))[result.type!]
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
      day.refunds.push(result as Refund)
    }
  }
}

travelSchema.methods.addOvernightRefunds = async function (this: TravelDoc) {
  if (this.claimOvernightLumpSum) {
    var stageIndex = 0
    for (var i = 0; i < this.days.length; i++) {
      const day = this.days[i]
      if (day.purpose == 'professional') {
        if (i == this.days.length - 1) {
          break
        }
        var midnight = (day.date as Date).valueOf() + 1000 * 24 * 60 * 60 - 1
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
        var amount = (await (day.country as CountryDoc).getLumpSum(day.date as Date, day.special))[result.type!]
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
        day.refunds.push(result as Refund)
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

travelSchema.methods.calculateExchangeRates = async function (this: TravelDoc) {
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
      Object.assign(stage.cost, (results[i] as PromiseFulfilledResult<Money>).value)
    }
    i++
  }
  for (const expense of this.expenses) {
    if (results[i].status === 'fulfilled') {
      Object.assign(expense.cost, (results[i] as PromiseFulfilledResult<Money>).value)
    }
    i++
  }
}

travelSchema.methods.calculateProfessionalShare = function (this: TravelDoc) {
  if (this.days.length > 0) {
    var professionalDays = 0
    var calc = false
    for (const day of this.days) {
      if (day.purpose === 'professional') {
        professionalDays += 1
      } else {
        calc = true
      }
    }
    if (calc) {
      this.professionalShare = professionalDays / this.days.length
    } else {
      this.professionalShare = 1
    }
  } else {
    this.professionalShare = null
  }
}

travelSchema.methods.calculateRefundforOwnCar = function (this: TravelDoc) {
  for (const stage of this.stages) {
    if (stage.transport.type === 'ownCar') {
      if (stage.transport.distance && stage.transport.distanceRefundType) {
        stage.cost = Object.assign(stage.cost, {
          amount: Math.round(stage.transport.distance * settings.distanceRefunds[stage.transport.distanceRefundType] * 100) / 100,
          currency: settings.baseCurrency
        })
      }
    }
  }
}

travelSchema.methods.addComment = function (this: TravelDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as TravelComment)
    delete this.comment
  }
}

travelSchema.methods.validateDates = function (this: TravelDoc) {
  const conflicts = new Set<string>()
  for (var i = 0; i < this.stages.length; i++) {
    for (var j = 0; j < this.stages.length; j++) {
      if (i !== j) {
        if (this.stages[i].departure.valueOf() < this.stages[j].departure.valueOf()) {
          if (this.stages[i].arrival.valueOf() <= this.stages[j].departure.valueOf()) {
            continue
          } else {
            if (this.stages[i].arrival.valueOf() <= this.stages[j].arrival.valueOf()) {
              // end of [i] inside of [j]
              conflicts.add('stages.' + i + '.arrival')
              conflicts.add('stages.' + j + '.departure')
            } else {
              // [j] inside of [i]
              conflicts.add('stages.' + j + '.arrival')
              conflicts.add('stages.' + j + '.departure')
            }
          }
        } else if (this.stages[i].departure.valueOf() < this.stages[j].arrival.valueOf()) {
          if (this.stages[i].arrival.valueOf() <= this.stages[j].arrival.valueOf()) {
            // [i] inside of [j]
            conflicts.add('stages.' + i + '.arrival')
            conflicts.add('stages.' + i + '.departure')
          } else {
            // end of [j] inside of [i]
            conflicts.add('stages.' + j + '.arrival')
            conflicts.add('stages.' + i + '.departure')
          }
        } else {
          continue
        }
      }
    }
  }
  for (const conflict of conflicts) {
    this.invalidate(conflict, 'stagesOverlapping')
  }
}

travelSchema.methods.validateCountries = function (this: TravelDoc) {
  const conflicts = []
  for (var i = 1; i < this.stages.length; i++) {
    if (this.stages[i - 1].endLocation.country._id !== this.stages[i].startLocation.country._id) {
      conflicts.push('stages.' + (i - 1) + '.endLocation.country')
      conflicts.push('stages.' + i + '.startLocation.country')
    }
  }
  for (const conflict of conflicts) {
    this.invalidate(conflict, 'countryChangeBetweenStages')
  }
}

travelSchema.pre('validate', function (this: TravelDoc) {
  this.addComment()
  this.validateDates()
  this.validateCountries()
})

travelSchema.pre('save', async function (this: TravelDoc, next) {
  await populate(this)

  this.calculateProgress()
  await this.calculateDays()
  this.calculateProfessionalShare()
  this.calculateRefundforOwnCar()
  await this.addCateringRefunds()
  await this.addOvernightRefunds()

  await this.calculateExchangeRates()

  next()
})

export default model<Travel, TravelModel>('Travel', travelSchema)

export interface TravelDoc extends Methods, HydratedDocument<Travel> {}
