import {
  Advance,
  AdvanceBase,
  AdvanceState,
  advanceStates,
  baseCurrency,
  Comment,
  idDocumentToId,
  MoneyNotNull,
  ReportModelNameWithoutAdvance,
  reportModelNamesWithoutAdvance,
  State
} from 'abrechnung-common/types.js'
import { getBaseCurrencyAmount, multiplyAmountAndRound, roundAmount, subtractAmounts } from 'abrechnung-common/utils/scripts.js'
import mongoose, { Document, HydratedDocument, Model, model, Query, Schema, Types } from 'mongoose'
import { createOperationServices } from '../factory.js'
import { setAdvanceBalance } from '../helper.js'
import { addHistoryEntry, addReferenceOnNewDocs, costObject, populateAll, populateSelected, requestBaseSchema, setLog } from './helper.js'
import ReportUsage from './reportUsage.js'

interface Methods {
  saveToHistory(save?: boolean, session?: mongoose.ClientSession | null): Promise<void>
  calculateExchangeRates(): Promise<void>
  addComment(): void
  offset(
    reportTotal: MoneyNotNull,
    reportModelName: ReportModelNameWithoutAdvance | 'offsetEntry',
    reportId: Types.ObjectId | null,
    subject: string,
    session?: mongoose.ClientSession | null
  ): Promise<MoneyNotNull>
}

const advanceSchema = () =>
  new Schema<Advance<Types.ObjectId>, Model<Advance<Types.ObjectId>>, Methods>(
    Object.assign(requestBaseSchema(advanceStates, AdvanceState.APPLIED_FOR, 'Advance', false), {
      reason: { type: String, required: true },
      budget: costObject({ exchangeRate: true, receipts: false, required: true, min: 0, defaultCurrency: baseCurrency._id }),
      exchangeRateDate: {
        type: Date,
        validate: { validator: (value: Date | string | number) => Date.now() >= new Date(value).valueOf(), message: 'futureNotAllowed' }
      },
      balance: costObject({ exchangeRate: true, receipts: false, required: true, min: 0, defaultCurrency: baseCurrency._id }),
      offsetAgainst: {
        type: [
          {
            type: { type: String, enum: [...reportModelNamesWithoutAdvance, 'offsetEntry'], required: true },
            reportId: { type: Schema.Types.ObjectId, refPath: 'offsetAgainst.type' },
            subject: { type: String },
            amount: { type: Number, min: 0, required: true },
            currency: { type: String, ref: 'Currency', required: true, default: baseCurrency._id },
            exchangeRate: { type: { date: { type: Date }, rate: { type: Number, min: 0 }, amount: { type: Number, min: 0 } } }
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
  balance: [{ path: 'balance.currency' }],
  offsetAgainst: [{ path: 'offsetAgainst.currency' }],
  bookings: [{ path: 'bookings.ledgerAccount' }, { path: 'bookings.project', select: { identifier: 1, organisation: 1 } }],
  project: [{ path: 'project' }],
  owner: [{ path: 'owner', select: { name: 1, email: 1, additionalDetails: 1 } }],
  editor: [{ path: 'editor', select: { name: 1, email: 1 } }],
  log: advanceStates.map((state) => ({ path: `log.${state}.by`, select: { name: 1, email: 1 } })),
  comments: [{ path: 'comments.author', select: { name: 1, email: 1 } }]
}
schema.pre(/^find((?!Update).)*$/, async function (this: Query<Advance<Types.ObjectId>, Advance<Types.ObjectId>>) {
  await populateSelected(this, populates)
})

schema.pre('deleteOne', { document: true, query: false }, async function () {
  await model('Advance').deleteMany({ _id: { $in: this.history } })
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
  const currency = idDocumentToId(this.budget.currency).toString()
  if (currency === baseCurrency._id) {
    this.exchangeRateDate = undefined
    this.budget.exchangeRate = null
    return
  }
  if (!this.exchangeRateDate) {
    this.budget.exchangeRate = null
    return
  }
  try {
    await createOperationServices().currencyConverter.addExchangeRate(this.budget, this.exchangeRateDate)
  } catch {
    this.budget.exchangeRate = null
  }
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
  reportTotal: MoneyNotNull,
  reportModelName: ReportModelNameWithoutAdvance | 'offsetEntry',
  reportId: Types.ObjectId | null,
  subject: string,
  session: mongoose.ClientSession | null = null
) {
  if (this.state < AdvanceState.APPROVED || this.settledOn || reportTotal.amount <= 0) {
    return reportTotal
  }
  const doc = await model<Advance<Types.ObjectId>, AdvanceModel>('Advance').findOne({ _id: this._id }).session(session)
  if (!doc) {
    return reportTotal
  }
  if (reportId && doc.offsetAgainst.some((o) => o.reportId?.equals(reportId))) {
    throw new Error('This report has already been used to offset this advance')
  }
  const advanceCurrency = idDocumentToId(doc.balance.currency).toString()
  const reportCurrency = idDocumentToId(reportTotal.currency).toString()
  let availableInReportCurrency: number
  if (advanceCurrency === reportCurrency) {
    availableInReportCurrency = doc.balance.amount
  } else if (reportCurrency === baseCurrency._id) {
    availableInReportCurrency = getBaseCurrencyAmount(doc.balance)
  } else {
    throw new Error(`Cannot offset ${advanceCurrency} advance with ${reportCurrency}`)
  }

  const amountInReportCurrency = Math.min(reportTotal.amount, availableInReportCurrency)
  const consumesCompleteBalance = amountInReportCurrency >= availableInReportCurrency
  const originalRate = doc.balance.exchangeRate?.rate
  let amountInAdvanceCurrency = amountInReportCurrency
  if (advanceCurrency !== reportCurrency) {
    if (!originalRate) {
      throw new Error(`Cannot offset foreign-currency advance ${doc._id.toString()} without an exchange rate`)
    }
    amountInAdvanceCurrency = consumesCompleteBalance ? doc.balance.amount : roundAmount(amountInReportCurrency / originalRate)
  }

  doc.balance.amount = consumesCompleteBalance ? 0 : roundAmount(subtractAmounts(doc.balance.amount, amountInAdvanceCurrency))
  if (doc.balance.exchangeRate?.rate) {
    doc.balance.exchangeRate.amount = multiplyAmountAndRound(doc.balance.amount, doc.balance.exchangeRate.rate)
  }
  if (doc.balance.amount === 0) {
    doc.settledOn = new Date()
  }

  const offsetExchangeRate =
    advanceCurrency !== baseCurrency._id && originalRate && doc.balance.exchangeRate
      ? { date: doc.balance.exchangeRate.date, rate: originalRate, amount: multiplyAmountAndRound(amountInAdvanceCurrency, originalRate) }
      : null
  doc.offsetAgainst.push({
    type: reportModelName,
    reportId,
    subject,
    amount: amountInAdvanceCurrency,
    currency: doc.balance.currency,
    exchangeRate: offsetExchangeRate
  })
  doc.markModified('offsetAgainst')
  await doc.save({ session })
  await recalcAllAssociatedReports(doc._id, session)
  const difference = roundAmount(subtractAmounts(reportTotal.amount, amountInReportCurrency))
  return {
    ...reportTotal,
    amount: difference,
    ...(reportTotal.exchangeRate
      ? { exchangeRate: { ...reportTotal.exchangeRate, amount: multiplyAmountAndRound(difference, reportTotal.exchangeRate.rate) } }
      : {})
  }
}

schema.methods.addComment = function () {
  if (this.comment) {
    this.comments.push({ text: this.comment, author: this.editor, toState: this.state } as Comment<Types.ObjectId, AdvanceState>)
    this.comment = undefined
  }
}

schema.pre('validate', async function () {
  this.addComment()
  await this.calculateExchangeRates()
  const isForeignCurrency = idDocumentToId(this.budget.currency).toString() !== baseCurrency._id
  if (!this.historic && this.state === AdvanceState.APPROVED && isForeignCurrency) {
    if (!this.exchangeRateDate) {
      this.invalidate('exchangeRateDate', 'required')
    } else if (!this.budget.exchangeRate) {
      this.invalidate('exchangeRateDate', 'exchangeRateUnavailable')
    }
  }
  if (!this.historic && this.state === AdvanceState.APPROVED && (this.isNew || this.isModified('state'))) {
    setAdvanceBalance(this)
  }
})

schema.pre('save', async function () {
  await populateAll(this, populates)
  setLog(this)
  await addReferenceOnNewDocs(this, 'Advance')
  if (!this.historic && this.state < AdvanceState.APPROVED) {
    this.bookings = []
  }
})

schema.post('save', async function () {
  if (this.$locals.SKIP_POST_SAFE_HOOK) {
    return
  }
  if (this.state === AdvanceState.APPROVED) {
    await ReportUsage.addOrUpdate(this)
  }
})

schema.index({ historic: 1, state: 1, project: 1 })
schema.index({ name: 'text', reason: 'text', 'comments.text': 'text' }, { weights: { name: 10, reason: 6, 'comments.text': 3 } })

export default model('Advance', schema)

export interface AdvanceDoc extends Methods, HydratedDocument<Advance<Types.ObjectId>> {}
