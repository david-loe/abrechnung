import { Document, HydratedDocument, Model, Schema, model } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import {
  Comment,
  Currency as ICurrency,
  Money,
  Travel,
  TravelRecord,
  TravelState,
  baseCurrency,
  distanceRefundTypes,
  lumpsumTypes,
  transportTypes,
  travelStates
} from '../../common/types.js'
import { travelCalculator } from '../factory.js'
import DocumentFile from './documentFile.js'
import { convertCurrency } from './exchangeRate.js'
import { costObject, logObject } from './helper.js'
import { ProjectDoc } from './project.js'
import User from './user.js'

function place(required = false, withPlace = true) {
  const obj: any = {
    country: { type: String, ref: 'Country', required: required },
    special: { type: String }
  }
  if (withPlace) {
    obj.place = { type: String, required: required }
  }
  return obj
}

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

type TravelModel = Model<Travel, {}, Methods>

const travelSchema = () =>
  new Schema<Travel, TravelModel, Methods>(
    {
      name: { type: String },
      owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
      state: {
        type: String,
        required: true,
        enum: travelStates,
        default: 'appliedFor'
      },
      log: logObject(travelStates),
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
      isCrossBorder: { type: Boolean },
      a1Certificate: { type: { exactAddress: { type: String, required: true }, destinationName: { type: String, required: true } } },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      advance: costObject(true, false, false, baseCurrency._id),
      addUp: {
        type: {
          balance: costObject(false, false, true, null, 0, null),
          total: costObject(false, false, true, null, 0),
          expenses: costObject(false, false, true, null, 0),
          advance: costObject(false, false, true, null, 0),
          lumpSums: costObject(false, false, true, null, 0)
        }
      },
      claimSpouseRefund: { type: Boolean },
      fellowTravelersNames: { type: String },
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
          cost: costObject(true, true, false),
          purpose: { type: String, enum: ['professional', 'mixed', 'private'] },
          note: { type: String }
        }
      ],
      expenses: [
        {
          description: { type: String, required: true },
          cost: costObject(true, true, true),
          purpose: { type: String, enum: ['professional', 'mixed'] },
          note: { type: String }
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
              refund: costObject(false, false, true)
            }
          ]
        }
      ]
    },
    { timestamps: true }
  )

function populate(doc: Document) {
  return Promise.allSettled([
    doc.populate({ path: 'advance.currency' }),
    doc.populate({ path: 'stages.cost.currency' }),
    doc.populate({ path: 'expenses.cost.currency' }),
    doc.populate({ path: 'project' }),
    doc.populate({ path: 'destinationPlace.country', select: { name: 1, flag: 1, currency: 1, needsA1Certificate: 1 } }),
    doc.populate({ path: 'lastPlaceOfWork.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.startLocation.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.endLocation.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.midnightCountries.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'days.country', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'stages.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'owner', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'editor', select: { name: 1, email: 1 } }),
    ...travelStates.map((state) => doc.populate({ path: `log.${state}.editor`, select: { name: 1, email: 1 } })),
    doc.populate({ path: 'comments.author', select: { name: 1, email: 1 } })
  ])
}

const schema = travelSchema()

schema.pre(/^find((?!Update).)*$/, function (this: TravelDoc) {
  populate(this)
})

schema.pre('deleteOne', { document: true, query: false }, function (this: TravelDoc) {
  for (const historyId of this.history) {
    model('Travel').deleteOne({ _id: historyId }).exec()
  }
  function deleteReceipts(records: TravelRecord[]) {
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

schema.methods.saveToHistory = async function (this: TravelDoc) {
  const doc: any = await model<Travel, TravelModel>('Travel').findOne({ _id: this._id }, { history: 0 }).lean()
  doc._id = undefined
  doc.updatedAt = new Date()
  doc.historic = true
  const old = await model('Travel').create([doc], { timestamps: false })
  this.history.push(old[0]._id)
  this.markModified('history')
  this.log[this.state] = { date: new Date(), editor: this.editor }

  if (this.state === 'approved') {
    // move vehicle registration of owner as receipt to 'ownCar' stages
    const receipts = []
    for (const stage of this.stages) {
      if (stage.transport.type === 'ownCar') {
        if (receipts.length === 0) {
          const owner = await User.findOne({ _id: this.owner._id }).lean()
          if (owner?.vehicleRegistration) {
            for (const vr of owner.vehicleRegistration) {
              const doc = await DocumentFile.findOne({ _id: vr._id }).lean()
              ;(doc as unknown as any)._id = undefined
              receipts.push(await DocumentFile.create(doc))
            }
          }
        }
        stage.cost.receipts = receipts
      }
    }
  }
}

async function exchange(costObject: Money, date: string | number | Date) {
  let exchangeRate = null

  if (costObject.amount !== null && costObject.amount > 0 && (costObject.currency as ICurrency)._id !== baseCurrency._id) {
    exchangeRate = await convertCurrency(date, costObject.amount, (costObject.currency as ICurrency)._id)
  }
  costObject.exchangeRate = exchangeRate

  return costObject
}

schema.methods.calculateExchangeRates = async function (this: TravelDoc) {
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
  let i = 1
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

schema.methods.addComment = function (this: TravelDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<TravelState>)
    this.comment = undefined
  }
}

schema.pre('validate', async function (this: TravelDoc, next) {
  this.addComment()

  await populate(this)

  const conflicts = await travelCalculator.calc(this)

  for (const conflict of conflicts) {
    this.invalidate(conflict.path, conflict.err, conflict.val)
  }

  await this.calculateExchangeRates()
  this.addUp = addUp(this)
  await populate(this)

  next()
})

schema.post('save', async function (this: TravelDoc) {
  if (this.state === 'refunded') {
    ;(this.project as ProjectDoc).updateBalance()
  }
})

export default model<Travel, TravelModel>('Travel', schema)

export interface TravelDoc extends Methods, HydratedDocument<Travel> {}
