import { Advance, BookingExportRow, ExpenseReport, User } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import createAgent, { loginUser } from '../_agent.js'
import { assertBookingsBalanced, requestBookingExport } from '../_booking.js'

const agent = await createAgent()

await loginUser(agent, 'expenseReport')
const user: User = (await agent.get('/user')).body.data

await loginUser(agent, 'advance')

let advance: Partial<Advance> = {
  reason: 'Traveling is expensive',
  owner: user,
  // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
  budget: { amount: 1_000, currency: 'EUR' as any }
}
const project = (await agent.get('/project')).body.data[0]
const category = (await agent.get('/category')).body.data.find(
  ({ for: value }: { for: string }) => value === 'ExpenseReport' || value === 'both'
)

advance.project = project
advance = (await agent.post('/approve/advance/approved').send(advance)).body.result

await loginUser(agent, 'expenseReport')
const expenseReport: ExpenseReport = (await agent.post('/expenseReport/inWork').send({ project, category, advances: [advance._id] })).body
  .result

const expense = {
  description: 'English Course',
  cost: {
    positions: [{ kind: 'manual', description: 'English Course', grossAmount: 100, vatRate: 0, project, category }],
    currency: { _id: 'EUR' },
    receipts: [{ name: 'Online Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
    date: new Date('2023-09-14T00:00:00.000Z')
  }
}

let req = agent.post('/expenseReport/expense').query({ parentId: expenseReport._id.toString() })
for (const entry of objectToFormFields(expense)) {
  if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
    req = req.attach(entry.field, entry.val)
  } else {
    req = req.field(entry.field, entry.val)
  }
}
await req

await agent.post('/expenseReport/underExamination').send({ _id: expenseReport._id })

await agent.post('/examine/expenseReport/reviewCompleted').send({ _id: expenseReport._id })

test.serial('correct balance after report review completed', async (t) => {
  const res = await agent.get('/advance').query({ _id: advance._id })
  const _advance: Advance = res.body.data
  t.is(_advance.balance.amount, 900)
  t.is(_advance.offsetAgainst.length, 1)
  t.is(_advance.offsetAgainst[0].reportId, expenseReport._id)
  t.is(_advance.offsetAgainst[0].subject, expenseReport.name)
})

test.serial('report bookings clear the applied advance instead of creating a liability', async (t) => {
  const res = await requestBookingExport(agent, '/book/expenseReport', [expenseReport._id])
  t.is(res.status, 200)
  const bookings = res.body.result.bookings as BookingExportRow[]
  t.deepEqual(res.body.result.sepaFiles, [])
  assertBookingsBalanced(t, bookings, 'ExpenseReport')
  t.deepEqual(
    bookings.map(({ side, amount, ledgerAccount }) => ({ side, amount, account: ledgerAccount.identifier })),
    [
      { side: 'debit', amount: 100, account: '4900' },
      { side: 'credit', amount: 100, account: '1530' }
    ]
  )
})

test.serial('cannot withdraw an advance used by a review-completed report', async (t) => {
  await loginUser(agent, 'advance')
  const res = await agent.post('/approve/advance/withdrawApproval').send({ _id: advance._id })
  t.not(res.status, 200)
  await loginUser(agent, 'expenseReport')
})

test.serial('correct balance after report booked', async (t) => {
  await agent.post('/book/expenseReport/booked').send([expenseReport._id])

  const res = await agent.get('/advance').query({ _id: advance._id })
  const _advance: Advance = res.body.data
  t.is(_advance.balance.amount, 900)
  t.is(_advance.offsetAgainst.length, 1)
  t.is(_advance.offsetAgainst[0].reportId, expenseReport._id)
  t.is(_advance.offsetAgainst[0].subject, expenseReport.name)
})

test.serial('correct balance after advance booked', async (t) => {
  await loginUser(agent, 'advance')
  await agent.post('/book/advance/booked').send([advance._id])
  await loginUser(agent, 'expenseReport')

  const res = await agent.get('/advance').query({ _id: advance._id })
  const _advance: Advance = res.body.data
  t.is(_advance.balance.amount, 900)
  t.is(_advance.offsetAgainst.length, 1)
  t.is(_advance.offsetAgainst[0].reportId, expenseReport._id)
  t.is(_advance.offsetAgainst[0].subject, expenseReport.name)
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
