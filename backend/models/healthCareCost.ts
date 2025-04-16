import { Document, HydratedDocument, Model, Schema, model } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import {
  Comment,
  HealthCareCost,
  HealthCareCostState,
  Currency as ICurrency,
  Money,
  baseCurrency,
  healthCareCostStates
} from '../../common/types.js'
import { convertCurrency } from './exchangeRate.js'
import { costObject, logObject } from './helper.js'
import { ProjectDoc } from './project.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

type HealthCareCostModel = Model<HealthCareCost, {}, Methods>

const healthCareCostSchema = () =>
  new Schema<HealthCareCost, HealthCareCostModel, Methods>(
    {
      name: { type: String },
      owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      patientName: { type: String, trim: true, required: true },
      insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance', required: true },
      project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
      state: {
        type: String,
        required: true,
        enum: healthCareCostStates,
        default: 'inWork'
      },
      log: logObject(healthCareCostStates),
      refundSum: costObject(true, true, false, baseCurrency._id),
      addUp: {
        type: {
          balance: costObject(false, false, true, null, 0, null),
          total: costObject(false, false, true, null, 0),
          expenses: costObject(false, false, true, null, 0)
        }
      },
      editor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      comments: [
        {
          text: { type: String },
          author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          toState: {
            type: String,
            required: true,
            enum: healthCareCostStates
          }
        }
      ],
      history: [{ type: Schema.Types.ObjectId, ref: 'HealthCareCost' }],
      historic: { type: Boolean, required: true, default: false },
      expenses: [
        {
          description: { type: String, required: true },
          cost: costObject(true, true, true),
          note: { type: String }
        }
      ]
    },
    { timestamps: true }
  )

function populate(doc: Document) {
  return Promise.allSettled([
    doc.populate({ path: 'insurance' }),
    doc.populate({ path: 'project' }),
    doc.populate({ path: 'refundSum.currency' }),
    doc.populate({ path: 'refundSum.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'expenses.cost.currency' }),
    doc.populate({ path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'owner', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'editor', select: { name: 1, email: 1 } }),
    ...healthCareCostStates.map((state) => doc.populate({ path: `log.${state}.editor`, select: { name: 1, email: 1 } })),
    doc.populate({ path: 'comments.author', select: { name: 1, email: 1 } })
  ])
}

const schema = healthCareCostSchema()

schema.pre(/^find((?!Update).)*$/, function (this: HealthCareCostDoc) {
  populate(this)
})

schema.pre('deleteOne', { document: true, query: false }, function (this: HealthCareCostDoc) {
  for (const historyId of this.history) {
    model('HealthCareCost').deleteOne({ _id: historyId }).exec()
  }
  for (const expense of this.expenses) {
    if (expense.cost) {
      for (const receipt of expense.cost.receipts) {
        model('DocumentFile').deleteOne({ _id: receipt._id }).exec()
      }
    }
  }
})

schema.methods.saveToHistory = async function (this: HealthCareCostDoc) {
  const doc: any = await model<HealthCareCost, HealthCareCostModel>('HealthCareCost').findOne({ _id: this._id }, { history: 0 }).lean()
  delete doc._id
  doc.updatedAt = new Date()
  doc.historic = true
  const old = await model('HealthCareCost').create([doc], { timestamps: false })
  this.history.push(old[0]._id)
  this.markModified('history')
  this.log[this.state] = { date: new Date(), editor: this.editor }
}

async function exchange(costObject: Money, date: string | number | Date) {
  let exchangeRate = null

  if (costObject.amount !== null && costObject.amount > 0 && (costObject.currency as ICurrency)._id !== baseCurrency._id) {
    exchangeRate = await convertCurrency(date, costObject.amount!, (costObject.currency as ICurrency)._id)
  }
  costObject.exchangeRate = exchangeRate

  return costObject
}

schema.methods.calculateExchangeRates = async function (this: HealthCareCostDoc) {
  const promiseList = []
  for (const expense of this.expenses) {
    promiseList.push(exchange(expense.cost, expense.cost.date))
  }
  const results = await Promise.allSettled(promiseList)
  let i = 0
  for (const expense of this.expenses) {
    if (results[i].status === 'fulfilled') {
      Object.assign(expense.cost, (results[i] as PromiseFulfilledResult<Money>).value)
    }
    i++
  }
}

schema.methods.addComment = function (this: HealthCareCostDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<HealthCareCostState>)
    delete this.comment
  }
}

schema.pre('validate', function (this: HealthCareCostDoc) {
  this.addComment()
})

schema.pre('save', async function (this: HealthCareCostDoc, next) {
  await populate(this)

  await this.calculateExchangeRates()
  this.addUp = addUp(this)
  next()
})

schema.post('save', async function (this: HealthCareCostDoc) {
  if (this.state === 'refunded') {
    ;(this.project as ProjectDoc).updateBalance()
  }
})

export default model<HealthCareCost, HealthCareCostModel>('HealthCareCost', schema)

export interface HealthCareCostDoc extends Methods, HydratedDocument<HealthCareCost> {}
