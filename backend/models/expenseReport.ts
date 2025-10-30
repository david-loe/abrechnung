import { AddUp, Comment, ExpenseReport, ExpenseReportState, expenseReportStates } from 'abrechnung-common/types.js'
import { addUp } from 'abrechnung-common/utils/scripts.js'
import mongoose, { HydratedDocument, Model, model, mongo, Query, Schema, Types } from 'mongoose'
import { currencyConverter } from '../factory.js'
import {
  addReferenceOnNewDocs,
  addToProjectBalance,
  costObject,
  offsetAdvance,
  populateAll,
  populateSelected,
  requestBaseSchema,
  setLog
} from './helper.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

// biome-ignore lint/complexity/noBannedTypes: mongoose uses {} as type
type ExpenseReportModel = Model<ExpenseReport<Types.ObjectId, mongo.Binary>, {}, Methods>

const expenseReportSchema = () =>
  new Schema<ExpenseReport<Types.ObjectId, mongo.Binary>, ExpenseReportModel, Methods>(
    Object.assign(requestBaseSchema(expenseReportStates, ExpenseReportState.IN_WORK, 'ExpenseReport', true, false), {
      category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
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

const schema = expenseReportSchema()

const populates = {
  category: [{ path: 'category' }],
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
  log: expenseReportStates.map((state) => ({ path: `log.${state}.by`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}

schema.pre(
  /^find((?!Update).)*$/,
  async function (this: Query<ExpenseReport<Types.ObjectId, mongo.Binary>, ExpenseReport<Types.ObjectId, mongo.Binary>>) {
    await populateSelected(this, populates)
  }
)

schema.pre('deleteOne', { document: true, query: false }, function (this: ExpenseReportDoc) {
  for (const historyId of this.history) {
    model('ExpenseReport').deleteOne({ _id: historyId }).exec()
  }
  for (const expense of this.expenses) {
    if (expense.cost) {
      for (const receipt of expense.cost.receipts) {
        model('DocumentFile').deleteOne({ _id: receipt._id }).exec()
      }
    }
  }
})

schema.methods.saveToHistory = async function (this: ExpenseReportDoc) {
  const m = model<ExpenseReport<Types.ObjectId, mongo.Binary>, ExpenseReportModel>('ExpenseReport')
  const doc = await m.findOne({ _id: this._id }, { history: 0 }).lean()
  if (!doc) {
    throw new Error('Expense Report not found')
  }
  doc._id = new mongoose.Types.ObjectId()
  doc.updatedAt = new Date()
  doc.historic = true
  const old = new m(doc)
  old.$locals.SKIP_POST_SAFE_HOOK = true
  await old.save({ timestamps: false })
  this.history.push(old._id)
  this.markModified('history')
  this.$locals.SKIP_POST_SAFE_HOOK = true
  await this.save()
  this.$locals.SKIP_POST_SAFE_HOOK = false
}

schema.methods.calculateExchangeRates = async function (this: ExpenseReportDoc) {
  const promiseList = []
  for (const expense of this.expenses) {
    promiseList.push(currencyConverter.addExchangeRate(expense.cost, expense.cost.date))
  }
  await Promise.allSettled(promiseList)
}

schema.methods.addComment = function (this: ExpenseReportDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<Types.ObjectId, ExpenseReportState>)
    this.comment = undefined
  }
}

schema.pre('validate', function (this: ExpenseReportDoc) {
  this.addComment()
})

schema.pre('save', async function (this: ExpenseReportDoc) {
  await populateAll(this, populates)

  await this.calculateExchangeRates()
  this.addUp = addUp(this) as AddUp<Types.ObjectId, ExpenseReport<Types.ObjectId, mongo.Binary>>[]
  await populateAll(this, populates)
  setLog(this)
  await addReferenceOnNewDocs(this, 'ExpenseReport')
})

schema.post('save', async function (this: ExpenseReportDoc) {
  if (this.$locals.SKIP_POST_SAFE_HOOK) {
    return
  }
  if (this.state === ExpenseReportState.REVIEW_COMPLETED) {
    await addToProjectBalance(this)
    await offsetAdvance(this, 'ExpenseReport')
  }
})

export default model<ExpenseReport<Types.ObjectId, mongo.Binary>, ExpenseReportModel>('ExpenseReport', schema)

export interface ExpenseReportDoc extends Methods, HydratedDocument<ExpenseReport<Types.ObjectId, mongo.Binary>> {}
