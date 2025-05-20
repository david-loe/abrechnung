import mongoose, { Document, HydratedDocument, Model, Query, Schema, model } from 'mongoose'
import { getBaseCurrencyAmount } from '../../common/scripts.js'
import {
  Advance,
  AdvanceBase,
  AdvanceState,
  Comment,
  ExpenseReport,
  HealthCareCost,
  ReportModelName,
  Travel,
  _id,
  advanceStates,
  baseCurrency
} from '../../common/types.js'
import { setAdvanceBalance } from '../helper.js'
import { addExchangeRate } from './exchangeRate.js'
import { costObject, populateAll, populateSelected, requestBaseSchema } from './helper.js'

interface Methods {
  saveToHistory(save?: boolean, session?: mongoose.ClientSession | null): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
  offset(
    reportTotal: number,
    reportModelName: ReportModelName,
    reportId: _id | null,
    session?: mongoose.ClientSession | null
  ): Promise<number>
}

type AdvanceModel = Model<Advance, {}, Methods>

const advanceSchema = () =>
  new Schema<Advance, AdvanceModel, Methods>(
    Object.assign(requestBaseSchema(advanceStates, 'appliedFor', 'Advance', false), {
      reason: { type: String, required: true },
      budget: costObject(true, false, true, baseCurrency._id),
      balance: Object.assign({ description: 'in EUR' }, costObject(false, false, true)),
      offsetAgainst: {
        type: [
          {
            type: { type: String, enum: ['Travel', 'ExpenseReport', 'HealthCareCost'], required: true },
            report: { type: Schema.Types.ObjectId, refPath: 'offsetAgainst.type' },
            amount: { type: Number, min: 0, required: true }
          }
        ]
      }
    }),
    { timestamps: true }
  )

const schema = advanceSchema()

const populates = {
  budget: [{ path: 'budget.currency' }],
  offsetAgainst: [{ path: 'offsetAgainst.report', select: { name: 1 } }],
  project: [{ path: 'project' }],
  owner: [{ path: 'owner', select: { name: 1, email: 1 } }],
  editor: [{ path: 'editor', select: { name: 1, email: 1 } }],
  log: advanceStates.map((state) => ({ path: `log.${state}.editor`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}
schema.pre(/^find((?!Update).)*$/, async function (this: Query<Advance, Advance>) {
  await populateSelected(this, populates)
})

schema.pre('deleteOne', { document: true, query: false }, function (this: AdvanceDoc) {
  for (const historyId of this.history) {
    model('Advance').deleteOne({ _id: historyId }).exec()
  }
})

schema.methods.saveToHistory = async function (this: AdvanceDoc, save = true, session: mongoose.ClientSession | null = null) {
  const doc: any = await model<Advance, AdvanceModel>('Advance').findOne({ _id: this._id }, { history: 0 }).session(session).lean()
  doc._id = undefined
  doc.updatedAt = new Date()
  doc.historic = true
  const old = await model('Advance').create([doc], { timestamps: false, session })
  this.history.push(old[0]._id)
  this.markModified('history')
  this.log[this.state] = { date: new Date(), editor: this.editor }
  if (this.state === 'appliedFor') {
    setAdvanceBalance(this)
  }
  if (save) {
    await this.save({ session })
  }
}

schema.methods.calculateExchangeRates = async function (this: AdvanceDoc) {
  await addExchangeRate(this.budget, this.createdAt ? this.createdAt : new Date())
}

async function recalcAllAssociatedReports(advanceId: _id, session: mongoose.ClientSession | null = null) {
  const reports: Document[] = []
  reports.push(
    ...(await model<Travel>('Travel')
      .find({ advances: advanceId, historic: false, state: { $ne: 'refunded' } })
      .session(session))
  )
  reports.push(
    ...(await model<ExpenseReport>('ExpenseReport')
      .find({ advances: advanceId, historic: false, state: { $ne: 'refunded' } })
      .session(session))
  )
  reports.push(
    ...(await model<HealthCareCost>('HealthCareCost')
      .find({
        advances: advanceId,
        historic: false,
        state: { $nin: ['refunded', 'underExaminationByInsurance'] }
      })
      .session(session))
  )
  for (const report of reports) {
    await report.save({ session })
  }
}

// When calling this method from populated paths, only the populated field are in die document
interface AdvanceBaseDoc extends Methods, HydratedDocument<AdvanceBase> {}

schema.methods.offset = async function (
  this: AdvanceBaseDoc,
  reportTotal: number,
  reportModelName: ReportModelName,
  reportId: _id | null,
  session: mongoose.ClientSession | null = null
) {
  if (this.state !== 'approved' || reportTotal <= 0) {
    return reportTotal
  }
  const doc = await model<Advance, AdvanceModel>('Advance').findOne({ _id: this._id }).session(session)
  if (!doc) {
    return reportTotal
  }
  let amount = reportTotal
  let difference = reportTotal - doc.balance.amount
  if (difference >= 0) {
    await doc.saveToHistory(false, session)
    amount = doc.balance.amount
    doc.balance.amount = 0
    doc.state = 'completed'
  } else {
    doc.balance.amount = -difference
    difference = 0
  }
  doc.offsetAgainst.push({ type: reportModelName, report: reportId as unknown as { _id: _id; name: string }, amount })
  doc.markModified('offsetAgainst')
  await doc.save({ session })
  await recalcAllAssociatedReports(doc._id, session)
  return difference
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

schema.pre('save', async function (this: AdvanceDoc) {
  await populateAll(this, populates)
  await this.calculateExchangeRates()
})

export default model<Advance, AdvanceModel>('Advance', schema)

export interface AdvanceDoc extends Methods, HydratedDocument<Advance> {}
