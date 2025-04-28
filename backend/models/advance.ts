import { Document, HydratedDocument, Model, Schema, model } from 'mongoose'
import { Advance, AdvanceState, Comment, advanceStates, baseCurrency } from '../../common/types.js'
import { addExchangeRate } from './exchangeRate.js'
import { costObject, requestBaseSchema } from './helper.js'

interface Methods {
  saveToHistory(): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
}

type AdvanceModel = Model<Advance, {}, Methods>

const advanceSchema = () =>
  new Schema<Advance, AdvanceModel, Methods>(
    Object.assign(requestBaseSchema(advanceStates, 'appliedFor', 'Advance', false), {
      budget: costObject(true, false, true, baseCurrency._id),
      balance: Object.assign({ description: 'in EUR' }, costObject(false, false, true)),
      runningBalance: Object.assign({ description: 'in EUR' }, costObject(false, false, true))
    }),
    { timestamps: true }
  )

function populate(doc: Document) {
  return Promise.allSettled([
    doc.populate({ path: 'budget.currency' }),
    doc.populate({ path: 'project' }),
    doc.populate({ path: 'owner', select: { name: 1, email: 1 } }),
    doc.populate({ path: 'editor', select: { name: 1, email: 1 } }),
    ...advanceStates.map((state) => doc.populate({ path: `log.${state}.editor`, select: { name: 1, email: 1 } })),
    doc.populate({ path: 'comments.author', select: { name: 1, email: 1 } })
  ])
}

const schema = advanceSchema()

schema.pre(/^find((?!Update).)*$/, function (this: AdvanceDoc) {
  populate(this)
})

schema.pre('deleteOne', { document: true, query: false }, function (this: AdvanceDoc) {
  for (const historyId of this.history) {
    model('Advance').deleteOne({ _id: historyId }).exec()
  }
})

schema.methods.saveToHistory = async function (this: AdvanceDoc) {
  const doc: any = await model<Advance, AdvanceModel>('Advance').findOne({ _id: this._id }, { history: 0 }).lean()
  doc._id = undefined
  doc.updatedAt = new Date()
  doc.historic = true
  const old = await model('Advance').create([doc], { timestamps: false })
  this.history.push(old[0]._id)
  this.markModified('history')
  this.log[this.state] = { date: new Date(), editor: this.editor }
}

schema.methods.calculateExchangeRates = async function (this: AdvanceDoc) {
  await addExchangeRate(this.budget, this.createdAt ? this.createdAt : new Date())
}

schema.methods.addComment = function (this: AdvanceDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<AdvanceState>)
    this.comment = undefined
  }
}

schema.pre('validate', function (this: AdvanceDoc) {
  this.addComment()
})

schema.pre('save', async function (this: AdvanceDoc, next) {
  await populate(this)
  await this.calculateExchangeRates()
  next()
})

export default model<Advance, AdvanceModel>('Advance', schema)

export interface AdvanceDoc extends Methods, HydratedDocument<Advance> {}
