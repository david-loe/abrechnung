import { HydratedDocument, Model, Query, Schema, model } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import {
  Comment,
  Travel,
  TravelRecord,
  TravelState,
  cateringTypes,
  distanceRefundTypes,
  transportTypes,
  travelStates
} from '../../common/types.js'
import { travelCalculator } from '../factory.js'
import { AdvanceDoc } from './advance.js'
import DocumentFile from './documentFile.js'
import { addExchangeRate } from './exchangeRate.js'
import { costObject, populateAll, populateSelected, requestBaseSchema } from './helper.js'
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
    Object.assign(requestBaseSchema(travelStates, 'appliedFor', 'Travel'), {
      reason: { type: String, required: true },
      destinationPlace: place(true),
      isCrossBorder: { type: Boolean },
      a1Certificate: { type: { exactAddress: { type: String, required: true }, destinationName: { type: String, required: true } } },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      addUp: {
        type: {
          balance: costObject(false, false, true),
          total: costObject(false, false, true),
          expenses: costObject(false, false, true),
          advance: costObject(false, false, true),
          lumpSums: costObject(false, false, true),
          advanceOverflow: { type: Boolean, required: true, default: false }
        }
      },
      claimSpouseRefund: { type: Boolean },
      fellowTravelersNames: { type: String },
      professionalShare: { type: Number, min: 0, max: 1 },
      lastPlaceOfWork: place(true, false),
      progress: { type: Number, min: 0, max: 100, default: 0 },
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
          cateringRefund: {
            breakfast: { type: Boolean, default: true },
            lunch: { type: Boolean, default: true },
            dinner: { type: Boolean, default: true }
          },
          overnightRefund: { type: Boolean, default: true },
          purpose: { type: String, enum: ['professional', 'private'], default: 'professional' },
          lumpSums: {
            overnight: { refund: costObject(false, false, true) },
            catering: {
              refund: costObject(false, false, true),
              type: { type: String, enum: cateringTypes, required: true, default: 'catering8' }
            }
          }
        }
      ]
    }),
    { timestamps: true }
  )

const schema = travelSchema()

const populates = {
  lastPlaceOfWork: [{ path: 'lastPlaceOfWork.country', select: { name: 1, flag: 1, currency: 1 } }],
  destinationPlace: [{ path: 'destinationPlace.country', select: { name: 1, flag: 1, currency: 1, needsA1Certificate: 1 } }],
  days: [{ path: 'days.country', select: { name: 1, flag: 1, currency: 1 } }],
  stages: [
    { path: 'stages.cost.currency' },
    { path: 'stages.cost.receipts', select: { name: 1, type: 1 } },
    { path: 'stages.startLocation.country', select: { name: 1, flag: 1, currency: 1 } },
    { path: 'stages.endLocation.country', select: { name: 1, flag: 1, currency: 1 } },
    { path: 'stages.midnightCountries.country', select: { name: 1, flag: 1, currency: 1 } }
  ],
  expenses: [{ path: 'expenses.cost.currency' }, { path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }],
  advances: [{ path: 'advances', select: { name: 1, balance: 1, budget: 1, runningBalance: 1, state: 1 } }],
  project: [{ path: 'project' }],
  owner: [{ path: 'owner', select: { name: 1, email: 1 } }],
  editor: [{ path: 'editor', select: { name: 1, email: 1 } }],
  log: travelStates.map((state) => ({ path: `log.${state}.editor`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}

schema.pre(/^find((?!Update).)*$/, function (this: Query<Travel, Travel>) {
  return populateSelected(this, populates)
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
              const doc: any = await DocumentFile.findOne({ _id: vr._id }).lean()
              doc._id = undefined
              receipts.push(await DocumentFile.create(doc))
            }
          }
        }
        stage.cost.receipts = receipts
      }
    }
  }
  await this.save()
}

schema.methods.calculateExchangeRates = async function (this: TravelDoc) {
  const promiseList = []
  for (const stage of this.stages) {
    promiseList.push(addExchangeRate(stage.cost, stage.cost.date))
  }
  for (const expense of this.expenses) {
    promiseList.push(addExchangeRate(expense.cost, expense.cost.date))
  }
  await Promise.allSettled(promiseList)
}

schema.methods.addComment = function (this: TravelDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<TravelState>)
    this.comment = undefined
  }
}

schema.pre('validate', async function (this: TravelDoc, next) {
  this.addComment()

  await populateAll(this, populates)

  const conflicts = await travelCalculator.calc(this)

  for (const conflict of conflicts) {
    this.invalidate(conflict.path, conflict.err, conflict.val)
  }

  await this.calculateExchangeRates()
  this.addUp = addUp(this)
  await populateAll(this, populates)

  next()
})

schema.post('save', async function (this: TravelDoc) {
  if (this.state === 'refunded') {
    ;(this.project as ProjectDoc).updateBalance()
    for (const advance of this.advances) {
      await (advance as AdvanceDoc).offset(this.addUp.total.amount || 0)
    }
  }
})

export default model<Travel, TravelModel>('Travel', schema)

export interface TravelDoc extends Methods, HydratedDocument<Travel> {}
