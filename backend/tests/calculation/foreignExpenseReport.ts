import { Advance, BookingExportRow, Category, ExpenseReport, ExpenseReportState, User } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import ExchangeRate from '../../models/exchangeRate.js'
import ExpenseReportModel from '../../models/expenseReport.js'
import createAgent, { loginUser } from '../_agent.js'
import { assertBookingsBalanced, requestBookingExport } from '../_booking.js'

const agent = await createAgent()
await loginUser(agent, 'expenseReport')
const user = (await agent.get('/user')).body.data as User
const project = (await agent.get('/project')).body.data[0]
const category = (await agent.get('/category')).body.data.find(
  ({ for: value }: Category) => value === 'ExpenseReport' || value === 'both'
) as Category

const today = new Date()
today.setUTCHours(0, 0, 0, 0)
const reportDate = new Date(today)
reportDate.setUTCDate(reportDate.getUTCDate() - 1)
await Promise.all([
  ExchangeRate.updateOne(
    { provider: 'Frankfurter', currency: 'USD', date: today },
    { $set: { provider: 'Frankfurter', currency: 'USD', date: today, rate: 1 / 0.95 } },
    { upsert: true }
  ),
  ExchangeRate.updateOne(
    { provider: 'Frankfurter', currency: 'USD', date: reportDate },
    { $set: { provider: 'Frankfurter', currency: 'USD', date: reportDate, rate: 1 / 0.9 } },
    { upsert: true }
  )
])

await loginUser(agent, 'advance')
const advance = (
  await agent
    .post('/approve/advance/approved')
    .send({
      name: 'USD advance calculation test',
      reason: 'Foreign expenses',
      owner: user,
      project,
      budget: { amount: 100, currency: 'USD' }
    })
).body.result as Advance

await loginUser(agent, 'expenseReport')
let report = (
  await agent
    .post('/expenseReport/inWork')
    .send({ name: 'USD expense report calculation test', project, currency: 'USD', exchangeRateDate: reportDate, advances: [advance._id] })
).body.result as ExpenseReport

const expense = {
  description: 'Foreign expense',
  cost: {
    positions: [{ kind: 'manual', description: 'Foreign expense', grossAmount: 150, vatRate: 0, project, category }],
    currency: { _id: 'USD' },
    receipts: [{ name: 'Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
    date: reportDate
  }
}
let request = agent.post('/expenseReport/expense').query({ parentId: report._id.toString() })
for (const entry of objectToFormFields(expense)) {
  if (entry.field.endsWith('[data]')) request = request.attach(entry.field, entry.val)
  else request = request.field(entry.field, entry.val)
}
report = (await request).body.result as ExpenseReport

test.serial('foreign expense report calculates in report currency and converts the final balance', (t) => {
  t.true(Math.abs((report.exchangeRate ?? 0) - 0.9) < Number.EPSILON)
  t.is(report.addUp[0].currency._id, 'USD')
  t.is(report.addUp[0].expenses.amount, 150)
  t.is(report.addUp[0].advance.amount, 100)
  t.is(report.addUp[0].balance.amount, 50)
})

test.serial('foreign expense report rejects an expense in a different currency', async (t) => {
  const mismatchingExpense = structuredClone(expense)
  mismatchingExpense.description = 'Wrong currency'
  mismatchingExpense.cost.currency = { _id: 'EUR' }
  let mismatchingRequest = agent.post('/expenseReport/expense').query({ parentId: report._id.toString() })
  for (const entry of objectToFormFields(mismatchingExpense)) {
    if (entry.field.endsWith('[data]')) mismatchingRequest = mismatchingRequest.attach(entry.field, entry.val)
    else mismatchingRequest = mismatchingRequest.field(entry.field, entry.val)
  }
  const response = await mismatchingRequest
  t.is(response.status, 422)
})

test.serial('foreign expense report cannot complete review without a recalculated exchange rate', async (t) => {
  const reviewResponse = await agent.post('/expenseReport/underExamination').send({ _id: report._id })
  t.is(reviewResponse.status, 200)

  await ExpenseReportModel.updateOne(
    { _id: report._id },
    { $set: { exchangeRateDate: new Date('1999-12-31T00:00:00.000Z'), exchangeRate: 0.9 } }
  )
  try {
    const completionResponse = await agent.post('/examine/expenseReport/reviewCompleted').send({ _id: report._id })
    t.is(completionResponse.status, 422)
    t.is(completionResponse.body.errors.exchangeRateDate.message, 'exchangeRateUnavailable')

    const storedReport = await ExpenseReportModel.findById(report._id).lean()
    t.is(storedReport?.state, ExpenseReportState.IN_REVIEW)
  } finally {
    await ExpenseReportModel.updateOne({ _id: report._id }, { $set: { exchangeRateDate: reportDate, exchangeRate: 0.9 } })
  }
})

test.serial('foreign expense report books the advance carrying value and exchange difference', async (t) => {
  await agent.post('/examine/expenseReport/reviewCompleted').send({ _id: report._id })

  const response = await requestBookingExport(agent, '/book/expenseReport', [report._id])
  t.is(response.status, 200)
  const bookings = response.body.result.bookings as BookingExportRow[]
  assertBookingsBalanced(t, bookings, 'ExpenseReport')
  t.deepEqual(
    bookings.map(({ side, amount, ledgerAccount }) => ({ side, amount, account: ledgerAccount.identifier })),
    [
      { side: 'debit', amount: 135, account: '4900' },
      { side: 'credit', amount: 95, account: '1530' },
      { side: 'credit', amount: 45, account: '1740' },
      { side: 'debit', amount: 5, account: '2660' }
    ]
  )
})

test.serial('foreign advance keeps its remaining balance in the original currency', async (t) => {
  await loginUser(agent, 'advance')
  const partialAdvance = (
    await agent
      .post('/approve/advance/approved')
      .send({
        name: 'Partially offset USD advance',
        reason: 'Foreign expenses',
        owner: user,
        project,
        budget: { amount: 100, currency: 'USD' }
      })
  ).body.result as Advance

  await loginUser(agent, 'expenseReport')
  let partialReport = (
    await agent
      .post('/expenseReport/inWork')
      .send({ name: 'Partial USD expense report', project, currency: 'USD', exchangeRateDate: reportDate, advances: [partialAdvance._id] })
  ).body.result as ExpenseReport
  const partialExpense = structuredClone(expense)
  partialExpense.description = 'Partial foreign expense'
  partialExpense.cost.positions[0].description = 'Partial foreign expense'
  partialExpense.cost.positions[0].grossAmount = 60
  let partialRequest = agent.post('/expenseReport/expense').query({ parentId: partialReport._id.toString() })
  for (const entry of objectToFormFields(partialExpense)) {
    if (entry.field.endsWith('[data]')) partialRequest = partialRequest.attach(entry.field, entry.val)
    else partialRequest = partialRequest.field(entry.field, entry.val)
  }
  partialReport = (await partialRequest).body.result as ExpenseReport

  await agent.post('/expenseReport/underExamination').send({ _id: partialReport._id })
  await agent.post('/examine/expenseReport/reviewCompleted').send({ _id: partialReport._id })

  const storedAdvance = (await agent.get('/advance').query({ _id: partialAdvance._id })).body.data as Advance
  t.is(storedAdvance.balance.currency._id, 'USD')
  t.is(storedAdvance.balance.amount, 40)
  t.is(storedAdvance.balance.exchangeRate?.amount, 38)
  t.is(storedAdvance.offsetAgainst[0].amount, 60)
  t.is(storedAdvance.offsetAgainst[0].currency._id, 'USD')
  t.is(storedAdvance.offsetAgainst[0].exchangeRate?.amount, 57)

  const response = await requestBookingExport(agent, '/book/expenseReport', [partialReport._id])
  t.is(response.status, 200)
  const bookings = response.body.result.bookings as BookingExportRow[]
  assertBookingsBalanced(t, bookings, 'ExpenseReport')
  t.deepEqual(
    bookings.map(({ side, amount, ledgerAccount }) => ({ side, amount, account: ledgerAccount.identifier })),
    [
      { side: 'debit', amount: 54, account: '4900' },
      { side: 'credit', amount: 57, account: '1530' },
      { side: 'debit', amount: 3, account: '2660' }
    ]
  )
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
