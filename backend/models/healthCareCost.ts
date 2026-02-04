import { AddUp, Comment, HealthCareCost, HealthCareCostState, healthCareCostStates } from 'abrechnung-common/types.js'
import { addUp } from 'abrechnung-common/utils/scripts.js'
import { HydratedDocument, Model, model, mongo, Query, Schema, Types } from 'mongoose'
import { currencyConverter } from '../factory.js'
import {
  addHistoryEntry,
  addReferenceOnNewDocs,
  addToProjectBalance,
  costObject,
  offsetAdvance,
  populateAll,
  populateSelected,
  requestBaseSchema,
  setLog
} from './helper.js'
import ReportUsage from './reportUsage.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

// biome-ignore lint/complexity/noBannedTypes: mongoose uses {} as type
type HealthCareCostModel = Model<HealthCareCost<Types.ObjectId, mongo.Binary>, {}, Methods>

const healthCareCostSchema = () =>
  new Schema<HealthCareCost<Types.ObjectId, mongo.Binary>, HealthCareCostModel, Methods>(
    Object.assign(requestBaseSchema(healthCareCostStates, HealthCareCostState.IN_WORK, 'HealthCareCost', true, false), {
      patientName: { type: String, trim: true, required: true },
      insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance', required: true },
      expenses: [
        {
          description: { type: String, required: true },
          cost: costObject(true, true, true, undefined),
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

schema.pre(
  /^find((?!Update).)*$/,
  async function (this: Query<HealthCareCost<Types.ObjectId, mongo.Binary>, HealthCareCost<Types.ObjectId, mongo.Binary>>) {
    await populateSelected(this, populates)
  }
)

schema.pre('deleteOne', { document: true, query: false }, function () {
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

schema.methods.saveToHistory = async function () {
  await addHistoryEntry(this, 'HealthCareCost')
  this.$locals.SKIP_POST_SAFE_HOOK = true
  await this.save()
  this.$locals.SKIP_POST_SAFE_HOOK = false
}

schema.methods.calculateExchangeRates = async function () {
  const promiseList = []
  for (const expense of this.expenses) {
    promiseList.push(currencyConverter.addExchangeRate(expense.cost, expense.cost.date))
  }
  await Promise.allSettled(promiseList)
}

schema.methods.addComment = function () {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<Types.ObjectId, HealthCareCostState>)
    this.comment = undefined
  }
}

schema.pre('validate', function () {
  this.addComment()
})

schema.pre('save', async function () {
  await populateAll(this, populates)

  await this.calculateExchangeRates()
  this.addUp = addUp(this) as AddUp<Types.ObjectId, HealthCareCost<Types.ObjectId, mongo.Binary>>[]
  await populateAll(this, populates)
  setLog(this)
  await addReferenceOnNewDocs(this, 'HealthCareCost')
})

schema.post('save', async function () {
  if (this.$locals.SKIP_POST_SAFE_HOOK) {
    return
  }
  if (this.state === HealthCareCostState.REVIEW_COMPLETED) {
    await addToProjectBalance(this)
    await offsetAdvance(this, 'HealthCareCost')
    await ReportUsage.addOrUpdate(this)
  }
})

schema.index(
  { name: 'text', 'comments.text': 'text', 'expenses.description': 'text' },
  { weights: { name: 10, 'expenses.description': 6, 'comments.text': 3 } }
)

export default model<HealthCareCost<Types.ObjectId, mongo.Binary>, HealthCareCostModel>('HealthCareCost', schema)

export interface HealthCareCostDoc extends Methods, HydratedDocument<HealthCareCost<Types.ObjectId, mongo.Binary>> {}
