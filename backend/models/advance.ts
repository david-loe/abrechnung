import {
  Advance,
  AdvanceBase,
  AdvanceState,
  advanceStates,
  baseCurrency,
  Comment,
  ReportModelNameWithoutAdvance,
  reportModelNamesWithoutAdvance,
  State
} from 'abrechnung-common/types.js'
import mongoose, { Document, HydratedDocument, Model, model, Query, Schema, Types } from 'mongoose'
import { currencyConverter } from '../factory.js'
import { setAdvanceBalance } from '../helper.js'
import { addHistoryEntry, addReferenceOnNewDocs, costObject, populateAll, populateSelected, requestBaseSchema, setLog } from './helper.js'
import ReportUsage from './reportUsage.js'

interface Methods {
  saveToHistory(save?: boolean, session?: mongoose.ClientSession | null): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
  offset(
    reportTotal: number,
    reportModelName: ReportModelNameWithoutAdvance | 'offsetEntry',
    reportId: Types.ObjectId | null,
    subject: string,
    session?: mongoose.ClientSession | null
  ): Promise<number>
}

const advanceSchema = () =>
  new Schema<Advance<Types.ObjectId>, Model<Advance<Types.ObjectId>>, Methods>(
    Object.assign(requestBaseSchema(advanceStates, AdvanceState.APPLIED_FOR, 'Advance', false), {
      reason: { type: String, required: true },
      budget: costObject(true, false, true, 0, baseCurrency._id),
      balance: Object.assign({ description: 'in EUR' }, costObject(false, false, true, 0)),
      offsetAgainst: {
        type: [
          {
            type: { type: String, enum: [...reportModelNamesWithoutAdvance, 'offsetEntry'], required: true },
            reportId: { type: Schema.Types.ObjectId, refPath: 'offsetAgainst.type' },
            subject: { type: String },
            amount: { type: Number, min: 0, required: true }
          }
        ]
      },
      receivedOn: { type: Date },
      settledOn: { type: Date }
    }),
    { timestamps: true }
  )

const schema = advanceSchema()

const populates = {
  budget: [{ path: 'budget.currency' }],
  project: [{ path: 'project' }],
  owner: [{ path: 'owner', select: { name: 1, email: 1 } }],
  editor: [{ path: 'editor', select: { name: 1, email: 1 } }],
  log: advanceStates.map((state) => ({ path: `log.${state}.by`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}
schema.pre(/^find((?!Update).)*$/, async function (this: Query<Advance<Types.ObjectId>, Advance<Types.ObjectId>>) {
  await populateSelected(this, populates)
})

schema.pre('deleteOne', { document: true, query: false }, function () {
  for (const historyId of this.history) {
    model('Advance').deleteOne({ _id: historyId }).exec()
  }
})

schema.methods.saveToHistory = async function (save = true, session: mongoose.ClientSession | null = null) {
  await addHistoryEntry(this, 'Advance', session)

  if (this.state === AdvanceState.APPLIED_FOR) {
    setAdvanceBalance(this)
  }
  if (save) {
    this.$locals.SKIP_POST_SAFE_HOOK = true
    await this.save({ session })
    this.$locals.SKIP_POST_SAFE_HOOK = false
  }
}

schema.methods.calculateExchangeRates = async function () {
  await currencyConverter.addExchangeRate(this.budget, this.createdAt ? this.createdAt : new Date())
}

async function recalcAllAssociatedReports(advanceId: Types.ObjectId, session: mongoose.ClientSession | null = null) {
  const reports: Document[] = []
  reports.push(
    ...(await model('Travel')
      .find({ advances: advanceId, historic: false, state: { $lt: State.BOOKABLE } })
      .session(session))
  )
  reports.push(
    ...(await model('ExpenseReport')
      .find({ advances: advanceId, historic: false, state: { $lt: State.BOOKABLE } })
      .session(session))
  )
  reports.push(
    ...(await model('HealthCareCost')
      .find({ advances: advanceId, historic: false, state: { $lt: State.BOOKABLE } })
      .session(session))
  )
  for (const report of reports) {
    await report.save({ session })
  }
}

// biome-ignore lint/complexity/noBannedTypes: mongoose uses {} as type
type AdvanceModel = Model<Advance<Types.ObjectId>, {}, Methods>
// When calling this method from populated paths, only the populated field are in the document
interface AdvanceBaseDoc extends Methods, HydratedDocument<AdvanceBase> {}

schema.methods.offset = async function (
  this: AdvanceBaseDoc,
  reportTotal: number,
  reportModelName: ReportModelNameWithoutAdvance | 'offsetEntry',
  reportId: Types.ObjectId | null,
  subject: string,
  session: mongoose.ClientSession | null = null
) {
  if (this.state < AdvanceState.APPROVED || this.settledOn || reportTotal <= 0) {
    return reportTotal
  }
  const doc = await model<Advance<Types.ObjectId>, AdvanceModel>('Advance').findOne({ _id: this._id }).session(session)
  if (!doc) {
    return reportTotal
  }
  if (reportId && doc.offsetAgainst.some((o) => o.reportId?.equals(reportId))) {
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
  doc.offsetAgainst.push({ type: reportModelName, reportId, subject, amount })
  doc.markModified('offsetAgainst')
  await doc.save({ session })
  await recalcAllAssociatedReports(doc._id, session)
  return difference
}

schema.methods.addComment = function () {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<Types.ObjectId, AdvanceState>)
    this.comment = undefined
  }
}

schema.pre('validate', function () {
  this.addComment()
})

schema.pre('save', async function () {
  await populateAll(this, populates)
  await this.calculateExchangeRates()
  setLog(this)
  await addReferenceOnNewDocs(this, 'Advance')
})

schema.post('save', async function () {
  if (this.$locals.SKIP_POST_SAFE_HOOK) {
    return
  }
  if (this.state === AdvanceState.APPROVED) {
    await ReportUsage.addOrUpdate(this)
  }
})

schema.index({ name: 'text', reason: 'text', 'comments.text': 'text' }, { weights: { name: 10, reason: 6, 'comments.text': 3 } })

export default model('Advance', schema)

export interface AdvanceDoc extends Methods, HydratedDocument<Advance<Types.ObjectId>> {}
