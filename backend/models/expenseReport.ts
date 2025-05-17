import mongoose, { HydratedDocument, Model, Query, Schema, model } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import { AddUp, AdvanceBase, Comment, ExpenseReport, ExpenseReportState, _id, expenseReportStates } from '../../common/types.js'
import { AdvanceDoc } from './advance.js'
import { addExchangeRate } from './exchangeRate.js'
import { costObject, offsetAdvance, populateAll, populateSelected, requestBaseSchema } from './helper.js'
import { ProjectDoc } from './project.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

type ExpenseReportModel = Model<ExpenseReport, {}, Methods>

const expenseReportSchema = () =>
  new Schema<ExpenseReport, ExpenseReportModel, Methods>(
    Object.assign(requestBaseSchema(expenseReportStates, 'inWork', 'ExpenseReport', true, false), {
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

const schema = expenseReportSchema()

const populates = {
  expenses: [{ path: 'expenses.cost.currency' }, { path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }],
  addUp: [{ path: 'addUp.project', select: { _id: 1, identifier: 1, organisation: 1 } }],
  advances: [{ path: 'advances', select: { name: 1, balance: 1, budget: 1, state: 1, project: 1 } }],

  project: [{ path: 'project' }],
  owner: [{ path: 'owner', select: { name: 1, email: 1 } }],
  editor: [{ path: 'editor', select: { name: 1, email: 1 } }],
  log: expenseReportStates.map((state) => ({ path: `log.${state}.editor`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}

schema.pre(/^find((?!Update).)*$/, async function (this: Query<ExpenseReport, ExpenseReport>) {
  await populateSelected(this, populates)
})

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
  const doc: any = await model<ExpenseReport, ExpenseReportModel>('ExpenseReport').findOne({ _id: this._id }, { history: 0 }).lean()
  doc._id = undefined
  doc.updatedAt = new Date()
  doc.historic = true
  const old = await model('ExpenseReport').create([doc], { timestamps: false })
  this.history.push(old[0]._id)
  this.markModified('history')
  this.log[this.state] = { date: new Date(), editor: this.editor }
  await this.save()
}

schema.methods.calculateExchangeRates = async function (this: ExpenseReportDoc) {
  const promiseList = []
  for (const expense of this.expenses) {
    promiseList.push(addExchangeRate(expense.cost, expense.cost.date))
  }
  await Promise.allSettled(promiseList)
}

schema.methods.addComment = function (this: ExpenseReportDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<ExpenseReportState>)
    this.comment = undefined
  }
}

schema.pre('validate', function (this: ExpenseReportDoc) {
  this.addComment()
})

schema.pre('save', async function (this: ExpenseReportDoc) {
  await populateAll(this, populates)

  await this.calculateExchangeRates()
  this.addUp = addUp(this) as AddUp<ExpenseReport>[]
  await populateAll(this, populates)
})

schema.post('save', async function (this: ExpenseReportDoc) {
  if (this.state === 'refunded') {
    await (this.project as ProjectDoc).updateBalance()
    await offsetAdvance(this, 'ExpenseReport')
  }
})

export default model<ExpenseReport, ExpenseReportModel>('ExpenseReport', schema)

export interface ExpenseReportDoc extends Methods, HydratedDocument<ExpenseReport> {}
