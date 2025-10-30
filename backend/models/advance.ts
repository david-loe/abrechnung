import {
  Advance,
  AdvanceBase,
  AdvanceState,
  advanceStates,
  baseCurrency,
  Comment,
  ExpenseReport,
  HealthCareCost,
  ReportModelName,
  State,
  Travel
} from 'abrechnung-common/types.js'
import mongoose, { Document, HydratedDocument, Model, model, Query, Schema, Types } from 'mongoose'
import { currencyConverter } from '../factory.js'
import { setAdvanceBalance } from '../helper.js'
import { addReferenceOnNewDocs, costObject, populateAll, populateSelected, requestBaseSchema, setLog } from './helper.js'

interface Methods {
  saveToHistory(save?: boolean, session?: mongoose.ClientSession | null): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
  offset(
    reportTotal: number,
    reportModelName: ReportModelName,
    reportId: Types.ObjectId | null,
    session?: mongoose.ClientSession | null
  ): Promise<number>
}

// biome-ignore lint/complexity/noBannedTypes: mongoose uses {} as type
type AdvanceModel = Model<Advance<Types.ObjectId>, {}, Methods>

const advanceSchema = () =>
  new Schema<Advance<Types.ObjectId>, AdvanceModel, Methods>(
    Object.assign(requestBaseSchema(advanceStates, AdvanceState.APPLIED_FOR, 'Advance', false), {
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
      },
      settledOn: { type: Date }
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
  log: advanceStates.map((state) => ({ path: `log.${state}.by`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}
schema.pre(/^find((?!Update).)*$/, async function (this: Query<Advance<Types.ObjectId>, Advance<Types.ObjectId>>) {
  await populateSelected(this, populates)
})

schema.pre('deleteOne', { document: true, query: false }, function (this: AdvanceDoc) {
  for (const historyId of this.history) {
    model('Advance').deleteOne({ _id: historyId }).exec()
  }
})

schema.methods.saveToHistory = async function (this: AdvanceDoc, save = true, session: mongoose.ClientSession | null = null) {
  const doc = await model<Advance<Types.ObjectId>, AdvanceModel>('Advance')
    .findOne({ _id: this._id }, { history: 0 })
    .session(session)
    .lean()
  if (!doc) {
    throw new Error('Advance not found')
  }
  doc._id = new mongoose.Types.ObjectId()
  doc.updatedAt = new Date()
  doc.historic = true
  const old = await model('Advance').create([doc], { timestamps: false, session })
  this.history.push(old[0]._id)
  this.markModified('history')
  if (this.state === AdvanceState.APPLIED_FOR) {
    setAdvanceBalance(this)
  }
  if (save) {
    await this.save({ session })
  }
}

schema.methods.calculateExchangeRates = async function (this: AdvanceDoc) {
  await currencyConverter.addExchangeRate(this.budget, this.createdAt ? this.createdAt : new Date())
}

async function recalcAllAssociatedReports(advanceId: Types.ObjectId, session: mongoose.ClientSession | null = null) {
  const reports: Document[] = []
  reports.push(
    ...(await model<Travel>('Travel')
      .find({ advances: advanceId, historic: false, state: { $lt: State.BOOKABLE } })
      .session(session))
  )
  reports.push(
    ...(await model<ExpenseReport>('ExpenseReport')
      .find({ advances: advanceId, historic: false, state: { $lt: State.BOOKABLE } })
      .session(session))
  )
  reports.push(
    ...(await model<HealthCareCost>('HealthCareCost')
      .find({ advances: advanceId, historic: false, state: { $lt: State.BOOKABLE } })
      .session(session))
  )
  for (const report of reports) {
    await report.save({ session })
  }
}

// When calling this method from populated paths, only the populated field are in the document
interface AdvanceBaseDoc extends Methods, HydratedDocument<AdvanceBase> {}

schema.methods.offset = async function (
  this: AdvanceBaseDoc,
  reportTotal: number,
  reportModelName: ReportModelName,
  reportId: Types.ObjectId | null,
  session: mongoose.ClientSession | null = null
) {
  if (this.state < AdvanceState.APPROVED || this.settledOn || reportTotal <= 0) {
    return reportTotal
  }
  const doc = await model<Advance<Types.ObjectId>, AdvanceModel>('Advance').findOne({ _id: this._id }).session(session)
  if (!doc) {
    return reportTotal
  }
  if (reportId && doc.offsetAgainst.some((o) => o.report?._id.equals(reportId))) {
    throw new Error('This report has already been used to offset this advance')
  }
  let amount = reportTotal
  let difference = reportTotal - doc.balance.amount
  if (difference >= 0) {
    amount = doc.balance.amount
    doc.balance.amount = 0
    doc.settledOn = new Date()
  } else {
    doc.balance.amount = -difference
    difference = 0
  }
  doc.offsetAgainst.push({ type: reportModelName, report: reportId as unknown as { _id: Types.ObjectId; name: string }, amount })
  doc.markModified('offsetAgainst')
  await doc.save({ session })
  await recalcAllAssociatedReports(doc._id, session)
  return difference
}

schema.methods.addComment = function (this: AdvanceDoc) {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<Types.ObjectId, AdvanceState>)
    this.comment = undefined
  }
}

schema.pre('validate', function (this: AdvanceDoc) {
  this.addComment()
})

schema.pre('save', async function (this: AdvanceDoc) {
  await populateAll(this, populates)
  await this.calculateExchangeRates()
  setLog(this)
  await addReferenceOnNewDocs(this, 'Advance')
})

export default model<Advance<Types.ObjectId>, AdvanceModel>('Advance', schema)

export interface AdvanceDoc extends Methods, HydratedDocument<Advance<Types.ObjectId>> {}
