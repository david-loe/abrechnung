import { Document, HydratedDocument, Model, Schema, model } from 'mongoose'
import { addUp } from '../../common/scripts.js'
import {
  Comment,
  ExpenseReport,
  ExpenseReportState,
  Currency as ICurrency,
  Money,
  baseCurrency,
  expenseReportStates
} from '../../common/types.js'
import { convertCurrency } from './exchangeRate.js'
import { costObject, requestBaseSchema } from './helper.js'
import { ProjectDoc } from './project.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

type ExpenseReportModel = Model<ExpenseReport, {}, Methods>

const expenseReportSchema = () =>
  new Schema<ExpenseReport, ExpenseReportModel, Methods>(
    Object.assign(requestBaseSchema(expenseReportStates, 'inWork', 'ExpenseReport'), {
      advance: costObject(true, false, false, baseCurrency._id),
      addUp: {
        type: {
          balance: costObject(false, false, true, null, 0, null),
          total: costObject(false, false, true),
          expenses: costObject(false, false, true),
          advance: costObject(false, false, true)
        }
      },
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

function populate(doc: Document) {
  return Promise.allSettled([
    doc.populate({ path: 'advance.currency' }),
    doc.populate({ path: 'expenses.cost.currency' }),
    doc.populate({ path: 'project' }),
    doc.populate({ path: 'expenses.cost.receipts', select: { name: 1, type: 1 } }),
    doc.populate({ path: 'owner', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'editor', select: { name: 1, email: 1 } }),
    ...expenseReportStates.map((state) => doc.populate({ path: `log.${state}.editor`, select: { name: 1, email: 1 } })),
    doc.populate({ path: 'comments.author', select: { name: 1, email: 1 } })
  ])
}

const schema = expenseReportSchema()

schema.pre(/^find((?!Update).)*$/, function (this: ExpenseReportDoc) {
  populate(this)
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
}

async function exchange(costObject: Money, date: string | number | Date) {
  let exchangeRate = null

  if (costObject.amount !== null && costObject.amount > 0) {
    exchangeRate = await convertCurrency(date, costObject.amount, (costObject.currency as ICurrency)._id)
  }
  costObject.exchangeRate = exchangeRate

  return costObject
}

schema.methods.calculateExchangeRates = async function (this: ExpenseReportDoc) {
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

schema.methods.addComment = function (this: ExpenseReportDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<ExpenseReportState>)
    this.comment = undefined
  }
}

schema.pre('validate', function (this: ExpenseReportDoc) {
  this.addComment()
})

schema.pre('save', async function (this: ExpenseReportDoc, next) {
  await populate(this)

  await this.calculateExchangeRates()
  this.addUp = addUp(this)
  next()
})

schema.post('save', async function (this: ExpenseReportDoc) {
  if (this.state === 'refunded') {
    ;(this.project as ProjectDoc).updateBalance()
  }
})

export default model<ExpenseReport, ExpenseReportModel>('ExpenseReport', schema)

export interface ExpenseReportDoc extends Methods, HydratedDocument<ExpenseReport> {}
