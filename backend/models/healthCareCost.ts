import { HydratedDocument, Model, Query, Schema, model } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import { Comment, HealthCareCost, HealthCareCostState, baseCurrency, healthCareCostStates } from '../../common/types.js'
import { AdvanceDoc } from './advance.js'
import { addExchangeRate } from './exchangeRate.js'
import { costObject, populateAll, populateSelected, requestBaseSchema } from './helper.js'
import { ProjectDoc } from './project.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

type HealthCareCostModel = Model<HealthCareCost, {}, Methods>

const healthCareCostSchema = () =>
  new Schema<HealthCareCost, HealthCareCostModel, Methods>(
    Object.assign(requestBaseSchema(healthCareCostStates, 'inWork', 'HealthCareCost', true, false), {
      patientName: { type: String, trim: true, required: true },
      insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance', required: true },
      refundSum: costObject(true, true, false, baseCurrency._id),
      expenses: [
        {
          description: { type: String, required: true },
          cost: costObject(true, true, true),
          note: { type: String }
        }
      ]
    }),
    { timestamps: true }
  )

const schema = healthCareCostSchema()

const populates = {
  refundSum: [{ path: 'refundSum.receipts', select: { name: 1, type: 1 } }, { path: 'refundSum.currency' }],
  insurance: [{ path: 'insurance' }],
  expenses: [{ path: 'expenses.cost.currency' }, { path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }],
  advances: [{ path: 'advances', select: { name: 1, balance: 1, budget: 1, state: 1 } }],
  project: [{ path: 'project' }],
  owner: [{ path: 'owner', select: { name: 1, email: 1 } }],
  editor: [{ path: 'editor', select: { name: 1, email: 1 } }],
  log: healthCareCostStates.map((state) => ({ path: `log.${state}.editor`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}

schema.pre(/^find((?!Update).)*$/, function (this: Query<HealthCareCost, HealthCareCost>) {
  return populateSelected(this, populates)
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
  doc._id = undefined
  doc.updatedAt = new Date()
  doc.historic = true
  const old = await model('HealthCareCost').create([doc], { timestamps: false })
  this.history.push(old[0]._id)
  this.markModified('history')
  this.log[this.state] = { date: new Date(), editor: this.editor }
  await this.save()
}

schema.methods.calculateExchangeRates = async function (this: HealthCareCostDoc) {
  const promiseList = []
  for (const expense of this.expenses) {
    promiseList.push(addExchangeRate(expense.cost, expense.cost.date))
  }
  await Promise.allSettled(promiseList)
}

schema.methods.addComment = function (this: HealthCareCostDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<HealthCareCostState>)
    this.comment = undefined
  }
}

schema.pre('validate', function (this: HealthCareCostDoc) {
  this.addComment()
})

schema.pre('save', async function (this: HealthCareCostDoc, next) {
  await populateAll(this, populates)

  await this.calculateExchangeRates()
  this.addUp = addUp(this)
  next()
})

schema.post('save', async function (this: HealthCareCostDoc) {
  if (this.state === 'refunded') {
    ;(this.project as ProjectDoc).updateBalance()
    let total = this.addUp.total.amount || 0
    this.advances.sort((a, b) => (a.balance.amount || 0) - (b.balance.amount || 0))
    for (const advance of this.advances) {
      total = await (advance as AdvanceDoc).offset(total, 'HealthCareCost', this._id)
    }
  }
})

export default model<HealthCareCost, HealthCareCostModel>('HealthCareCost', schema)

export interface HealthCareCostDoc extends Methods, HydratedDocument<HealthCareCost> {}
