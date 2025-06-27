import mongoose, { HydratedDocument, Model, model, Query, Schema } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import { AddUp, Comment, HealthCareCost, HealthCareCostState, healthCareCostStates } from '../../common/types.js'
import { addExchangeRate } from './exchangeRate.js'
import { addToProjectBalance, costObject, offsetAdvance, populateAll, populateSelected, requestBaseSchema, setLog } from './helper.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

// biome-ignore lint/complexity/noBannedTypes: mongoose uses {} as type
type HealthCareCostModel = Model<HealthCareCost, {}, Methods>

const healthCareCostSchema = () =>
  new Schema<HealthCareCost, HealthCareCostModel, Methods>(
    Object.assign(requestBaseSchema(healthCareCostStates, HealthCareCostState.IN_WORK, 'HealthCareCost', true, false), {
      patientName: { type: String, trim: true, required: true },
      insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance', required: true },
      expenses: [
        {
          description: { type: String, required: true },
          cost: costObject(true, true, true),
          project: { type: Schema.Types.ObjectId, ref: 'Project' },
          note: { type: String }
        }
      ]
    }),
    { timestamps: true }
  )

const schema = healthCareCostSchema()

const populates = {
  insurance: [{ path: 'insurance' }],
  expenses: [
    { path: 'expenses.cost.currency' },
    { path: 'expenses.cost.receipts', select: { name: 1, type: 1 } },
    { path: 'expenses.project', select: { identifier: 1, organisation: 1 } }
  ],
  addUp: [{ path: 'addUp.project', select: { identifier: 1, organisation: 1 } }],
  advances: [{ path: 'advances', select: { name: 1, balance: 1, budget: 1, state: 1, project: 1 } }],
  project: [{ path: 'project' }],
  owner: [{ path: 'owner', select: { name: 1, email: 1 } }],
  editor: [{ path: 'editor', select: { name: 1, email: 1 } }],
  log: healthCareCostStates.map((state) => ({ path: `log.${state}.by`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}

schema.pre(/^find((?!Update).)*$/, async function (this: Query<HealthCareCost, HealthCareCost>) {
  await populateSelected(this, populates)
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
  const doc = await model<HealthCareCost, HealthCareCostModel>('HealthCareCost').findOne({ _id: this._id }, { history: 0 }).lean()
  if (!doc) {
    throw new Error('Health Care Cost not found')
  }
  doc._id = new mongoose.Types.ObjectId()
  doc.updatedAt = new Date()
  doc.historic = true
  const old = await model('HealthCareCost').create([doc], { timestamps: false })
  this.history.push(old[0]._id)
  this.markModified('history')
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

schema.pre('save', async function (this: HealthCareCostDoc) {
  await populateAll(this, populates)

  await this.calculateExchangeRates()
  this.addUp = addUp(this) as AddUp<HealthCareCost>[]
  await populateAll(this, populates)
  setLog(this)
})

schema.post('save', async function (this: HealthCareCostDoc) {
  if (this.state === HealthCareCostState.REVIEW_COMPLETED) {
    await addToProjectBalance(this)
    await offsetAdvance(this, 'HealthCareCost')
  }
})

export default model<HealthCareCost, HealthCareCostModel>('HealthCareCost', schema)

export interface HealthCareCostDoc extends Methods, HydratedDocument<HealthCareCost> {}
