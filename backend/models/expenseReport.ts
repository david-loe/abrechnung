import { Document, HydratedDocument, Model, Schema, model } from 'mongoose'
import { ExpenseReport, ExpenseReportComment, Currency as ICurrency, Money, baseCurrency, expenseReportStates } from '../../common/types.js'
import { convertCurrency, costObject } from './helper.js'
import { ProjectDoc } from './project.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

type ExpenseReportModel = Model<ExpenseReport, {}, Methods>

const expenseReportSchema = new Schema<ExpenseReport, ExpenseReportModel, Methods>(
  {
    name: { type: String },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    state: {
      type: String,
      required: true,
      enum: expenseReportStates,
      default: 'inWork'
    },
    editor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comments: [
      {
        text: { type: String },
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        toState: {
          type: String,
          required: true,
          enum: expenseReportStates
        }
      }
    ],
    advance: costObject(true, false, false, baseCurrency._id),
    history: [{ type: Schema.Types.ObjectId, ref: 'ExpenseReport' }],
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
    doc.populate({ path: 'advance.currency' }),
    doc.populate({ path: 'expenses.cost.currency' }),
    doc.populate({ path: 'project' }),
    doc.populate({ path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'owner', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'editor', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'comments.author', select: { name: 1, email: 1 } })
  ])
}

expenseReportSchema.pre(/^find((?!Update).)*$/, function (this: ExpenseReportDoc) {
  populate(this)
})

expenseReportSchema.pre('deleteOne', { document: true, query: false }, function (this: ExpenseReportDoc) {
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

expenseReportSchema.methods.saveToHistory = async function (this: ExpenseReportDoc) {
  const doc: any = await model<ExpenseReport, ExpenseReportModel>('ExpenseReport').findOne({ _id: this._id }, { history: 0 }).lean()
  delete doc._id
  doc.historic = true
  const old = await model('ExpenseReport').create(doc)
  this.history.push(old)
  this.markModified('history')
}

async function exchange(costObject: Money, date: string | number | Date) {
  var exchangeRate = null

  if (costObject.amount !== null && costObject.amount > 0) {
    exchangeRate = await convertCurrency(date, costObject.amount!, (costObject.currency as ICurrency)._id)
  }
  costObject.exchangeRate = exchangeRate

  return costObject
}

expenseReportSchema.methods.calculateExchangeRates = async function (this: ExpenseReportDoc) {
  const promiseList = []
  for (const expense of this.expenses) {
    promiseList.push(exchange(expense.cost, expense.cost.date))
  }
  const results = await Promise.allSettled(promiseList)
  var i = 0
  for (const expense of this.expenses) {
    if (results[i].status === 'fulfilled') {
      Object.assign(expense.cost, (results[i] as PromiseFulfilledResult<Money>).value)
    }
    i++
  }
}

expenseReportSchema.methods.addComment = function (this: ExpenseReportDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as ExpenseReportComment)
    delete this.comment
  }
}

expenseReportSchema.pre('validate', function (this: ExpenseReportDoc) {
  this.addComment()
})

expenseReportSchema.pre('save', async function (this: ExpenseReportDoc, next) {
  await populate(this)

  await this.calculateExchangeRates()

  next()
})

expenseReportSchema.post('save', async function (this: ExpenseReportDoc) {
  if (this.state === 'refunded') {
    ;(this.project as ProjectDoc).updateBalance()
  }
})

export default model<ExpenseReport, ExpenseReportModel>('ExpenseReport', expenseReportSchema)

export interface ExpenseReportDoc extends Methods, HydratedDocument<ExpenseReport> {}
