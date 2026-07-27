import { AddUp, Comment, HealthCareCost, HealthCareCostState, healthCareCostStates } from 'abrechnung-common/types.js'
import { addUp } from 'abrechnung-common/utils/scripts.js'
import { HydratedDocument, Model, model, mongo, Query, Schema, Types } from 'mongoose'
import { createOperationServices } from '../factory.js'
import {
  addHistoryEntry,
  addReferenceOnNewDocs,
  addToProjectBalance,
  getCostPositionValidationIssues,
  offsetAdvance,
  populateAll,
  populateSelected,
  positionedCostObject,
  requestBaseSchema,
  setLog
} from './helper.js'
import ReportUsage from './reportUsage.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

const healthCareCostSchema = () =>
  new Schema<HealthCareCost<Types.ObjectId, mongo.Binary>, Model<HealthCareCost<Types.ObjectId, mongo.Binary>>, Methods>(
    Object.assign(requestBaseSchema(healthCareCostStates, HealthCareCostState.IN_WORK, 'HealthCareCost', true, false), {
      patientName: { type: String, trim: true, required: true },
      insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance', required: true },
      expenses: [
        {
          description: { type: String, required: true },
          cost: positionedCostObject({ required: true, receiptsRequired: false }),
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
    { path: 'expenses.cost.positions.project', select: { identifier: 1, organisation: 1 } },
    { path: 'expenses.cost.positions.category' }
  ],
  addUp: [{ path: 'addUp.project', select: { identifier: 1, organisation: 1 } }],
  advances: [{ path: 'advances', select: { name: 1, balance: 1, budget: 1, state: 1, project: 1 } }],
  bookings: [{ path: 'bookings.ledgerAccount' }, { path: 'bookings.project', select: { identifier: 1, organisation: 1 } }],
  project: [{ path: 'project' }],
  owner: [{ path: 'owner', select: { name: 1, email: 1, additionalDetails: 1 } }],
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

schema.pre('deleteOne', { document: true, query: false }, async function () {
  const receiptIds: (string | Types.ObjectId)[] = []
  for (const expense of this.expenses) {
    if (expense.cost) {
      for (const receipt of expense.cost.receipts) {
        receiptIds.push(receipt._id)
      }
    }
  }
  await Promise.all([
    model('HealthCareCost').deleteMany({ _id: { $in: this.history } }),
    model('DocumentFile').deleteMany({ _id: { $in: receiptIds } })
  ])
})

schema.methods.saveToHistory = async function () {
  await addHistoryEntry(this, 'HealthCareCost')
  this.$locals.SKIP_POST_SAFE_HOOK = true
  await this.save()
  this.$locals.SKIP_POST_SAFE_HOOK = false
}

schema.methods.calculateExchangeRates = async function () {
  const { currencyConverter } = createOperationServices()
  const promiseList = []
  for (const expense of this.expenses) {
    promiseList.push(currencyConverter.addCostExchangeRate(expense.cost, expense.cost.date as Date))
  }
  await Promise.all(promiseList)
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

schema.pre('validate', async function () {
  if (!this.isNew && !this.isModified('expenses')) return
  const issues = await getCostPositionValidationIssues(
    this.expenses.map(({ cost }) => cost),
    'ExpenseReport',
    true,
    false
  )
  for (const issue of issues) {
    this.invalidate(`expenses.${issue.path.replace(/^(\d+)\./, '$1.cost.')}`, issue.message)
  }
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

export default model('HealthCareCost', schema)

export interface HealthCareCostDoc extends Methods, HydratedDocument<HealthCareCost<Types.ObjectId, mongo.Binary>> {}
