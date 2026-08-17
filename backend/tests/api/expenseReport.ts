import {
  BookingExportRow,
  Category,
  ExpenseReport,
  ExpenseReportSimple,
  ExpenseReportState,
  idDocumentToId
} from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import { shutdown } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import LedgerAccount from '../../models/ledgerAccount.js'
import Organisation from '../../models/organisation.js'
import User from '../../models/user.js'
import createAgent, { loginUser } from '../_agent.js'
import { assertBookingsBalanced, requestBookingExport } from '../_booking.js'

const agent = await createAgent()
await loginUser(agent, 'user')

//@ts-expect-error
let expenseReport: ExpenseReportSimple = { name: 'Expenses from last Month' }
let category: Category

function createCost(amount: number, currency: unknown, date: Date, receipts: unknown[] = []) {
  return {
    positions: [{ kind: 'manual', grossAmount: amount, vatRate: 0, project: expenseReport.project, category }],
    currency,
    receipts,
    date
  }
}

function createBulkCost(amount: number, currency: string, date: Date) {
  return {
    positions: [
      {
        kind: 'manual' as const,
        grossAmount: amount,
        vatRate: 0,
        project: expenseReport.project._id.toString(),
        category: category._id.toString()
      }
    ],
    currency,
    date
  }
}

async function postMultipartExpense(endpoint: string, parentId: string, expense: unknown) {
  let req = agent.post(endpoint).query({ parentId })
  for (const entry of objectToFormFields(expense)) {
    if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
      req = req.attach(entry.field, entry.val)
    } else {
      req = req.field(entry.field, entry.val)
    }
  }
  return await req
}

test.serial('GET /project', async (t) => {
  const res = await agent.get('/project')
  expenseReport.project = res.body.data[0]
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /category', async (t) => {
  const res = await agent.get('/category')
  category = res.body.data.find(({ for: value }: Category) => value === 'ExpenseReport' || value === 'both')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('POST /expenseReport/inWork', async (t) => {
  const res = await agent.post('/expenseReport/inWork').send(expenseReport)
  expenseReport = res.body.result
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /expenseReport', async (t) => {
  t.plan(2)
  const res = await agent.get('/expenseReport')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  for (const gotExpenseReport of res.body.data as ExpenseReportSimple[]) {
    if (expenseReport._id === gotExpenseReport._id) {
      t.pass()
      break
    }
  }
})

test.serial('POST /expenseReport/expense/bulk', async (t) => {
  let tempExpenseReport: ExpenseReportSimple | undefined

  try {
    const tempReportResponse = await agent.post('/expenseReport/inWork').send({ name: 'Bulk Import Test', project: expenseReport.project })
    t.is(tempReportResponse.status, 200)

    tempExpenseReport = tempReportResponse.body.result as ExpenseReportSimple
    const bulkExpenses = [
      { description: 'Imported Taxi', cost: createBulkCost(28.4, 'EUR', new Date('2023-09-10T00:00:00.000Z')) },
      { description: 'Imported Meal', cost: createBulkCost(16.9, 'USD', new Date('2023-09-11T00:00:00.000Z')), note: 'Imported from CSV' }
    ]

    const bulkResponse = await agent
      .post('/expenseReport/expense/bulk')
      .query({ parentId: tempExpenseReport._id.toString() })
      .send(bulkExpenses)
    t.is(bulkResponse.status, 200)
    t.is((bulkResponse.body.result as ExpenseReport).expenses.length, bulkExpenses.length)
  } finally {
    if (tempExpenseReport?._id) {
      const deleteResponse = await agent.delete('/expenseReport').query({ _id: tempExpenseReport._id.toString() })
      t.is(deleteResponse.status, 200)
    }
  }
})

test.serial('POST /expenseReport/expense/bulk is atomic', async (t) => {
  let tempExpenseReport: ExpenseReportSimple | undefined

  try {
    const tempReportResponse = await agent.post('/expenseReport/inWork').send({ name: 'Bulk Atomic Test', project: expenseReport.project })
    t.is(tempReportResponse.status, 200)

    tempExpenseReport = tempReportResponse.body.result as ExpenseReportSimple
    const bulkResponse = await agent
      .post('/expenseReport/expense/bulk')
      .query({ parentId: tempExpenseReport._id.toString() })
      .send([
        { description: 'Imported Taxi', cost: createBulkCost(28.4, 'EUR', new Date('2023-09-10T00:00:00.000Z')) },
        { cost: createBulkCost(16.9, 'USD', new Date('2023-09-11T00:00:00.000Z')), note: 'Imported from CSV' }
      ])
    t.is(bulkResponse.status, 422)

    const reportResponse = await agent
      .get('/expenseReport')
      .query({ _id: tempExpenseReport._id.toString(), additionalFields: ['expenses'] })
    t.is(reportResponse.status, 200)
    t.is((reportResponse.body.data as ExpenseReport).expenses.length, 0)
  } finally {
    if (tempExpenseReport?._id) {
      const deleteResponse = await agent.delete('/expenseReport').query({ _id: tempExpenseReport._id.toString() })
      t.is(deleteResponse.status, 200)
    }
  }
})

test.serial('POST /expenseReport/expense/bulk strips foreign receipt references', async (t) => {
  let foreignUser: { _id: string; access: Record<string, boolean> } | undefined
  let originalForeignUserAccess: Record<string, boolean> | undefined
  let foreignReport: ExpenseReportSimple | undefined
  let targetReport: ExpenseReportSimple | undefined

  try {
    await loginUser(agent, 'admin')
    const foreignUserResponse = await agent
      .get('/admin/user')
      .query({ filterJSON: Buffer.from(JSON.stringify({ 'fk.ldapauth': 'leela' })).toString('base64') })
    t.is(foreignUserResponse.status, 200)

    foreignUser = foreignUserResponse.body.data[0]
    t.truthy(foreignUser, 'Expected to find the foreign user for bulk receipt test setup')
    if (!foreignUser) {
      return
    }
    originalForeignUserAccess = { ...foreignUser.access }
    const foreignUserUpdateResponse = await agent
      .post('/admin/user')
      .send({ _id: foreignUser._id, access: { ...foreignUser.access, 'inWork:expenseReport': true } })
    t.is(foreignUserUpdateResponse.status, 200)

    await loginUser(agent, 'expenseReport')
    const foreignReportResponse = await agent
      .post('/expenseReport/inWork')
      .send({ name: 'Foreign Receipt Source', project: expenseReport.project })
    t.is(foreignReportResponse.status, 200)

    foreignReport = foreignReportResponse.body.result as ExpenseReportSimple
    const foreignExpense = {
      description: 'Foreign Receipt Expense',
      cost: createCost(12, { _id: 'EUR' }, new Date('2023-09-12T00:00:00.000Z'), [
        { name: 'Foreign Receipt.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }
      ])
    }

    const foreignExpenseResponse = await postMultipartExpense('/expenseReport/expense', foreignReport._id.toString(), foreignExpense)
    t.is(foreignExpenseResponse.status, 200)

    const foreignReceiptId = (foreignExpenseResponse.body.result as ExpenseReport).expenses[0].cost.receipts[0]._id

    await loginUser(agent, 'user')
    const targetReportResponse = await agent
      .post('/expenseReport/inWork')
      .send({ name: 'Bulk Receipt Target', project: expenseReport.project })
    t.is(targetReportResponse.status, 200)

    targetReport = targetReportResponse.body.result as ExpenseReportSimple
    const bulkResponse = await agent
      .post('/expenseReport/expense/bulk')
      .query({ parentId: targetReport._id.toString() })
      .send([
        {
          description: 'Imported Expense',
          cost: { ...createBulkCost(42, 'EUR', new Date('2023-09-13T00:00:00.000Z')), receipts: [{ _id: foreignReceiptId }] }
        }
      ])
    t.is(bulkResponse.status, 200)
    t.is((bulkResponse.body.result as ExpenseReport).expenses[0].cost.receipts.length, 0)
  } finally {
    if (targetReport?._id) {
      await loginUser(agent, 'user')
      const targetDeleteResponse = await agent.delete('/expenseReport').query({ _id: targetReport._id.toString() })
      t.is(targetDeleteResponse.status, 200)
    }

    if (foreignReport?._id) {
      await loginUser(agent, 'expenseReport')
      const foreignDeleteResponse = await agent.delete('/expenseReport').query({ _id: foreignReport._id.toString() })
      t.is(foreignDeleteResponse.status, 200)
    }

    if (foreignUser?._id && originalForeignUserAccess) {
      await loginUser(agent, 'admin')
      const restoreForeignUserResponse = await agent.post('/admin/user').send({ _id: foreignUser._id, access: originalForeignUserAccess })
      t.is(restoreForeignUserResponse.status, 200)
    }

    await loginUser(agent, 'user')
  }
})

test.serial('POST /examine/expenseReport/expense/bulk is atomic', async (t) => {
  let tempExpenseReport: ExpenseReportSimple | undefined

  try {
    await loginUser(agent, 'user')
    const tempReportResponse = await agent
      .post('/expenseReport/inWork')
      .send({ name: 'Examine Bulk Atomic Test', project: expenseReport.project })
    t.is(tempReportResponse.status, 200)

    tempExpenseReport = tempReportResponse.body.result as ExpenseReportSimple
    const initialExpense = {
      description: 'Initial Expense',
      cost: createCost(82, { _id: 'GBP' }, new Date('2023-09-14T00:00:00.000Z'), [
        { name: 'Online Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }
      ])
    }

    const expenseResponse = await postMultipartExpense('/expenseReport/expense', tempExpenseReport._id.toString(), initialExpense)
    t.is(expenseResponse.status, 200)

    const underExaminationResponse = await agent.post('/expenseReport/underExamination').send({ _id: tempExpenseReport._id.toString() })
    t.is(underExaminationResponse.status, 200)

    await loginUser(agent, 'expenseReport')
    const bulkResponse = await agent
      .post('/examine/expenseReport/expense/bulk')
      .query({ parentId: tempExpenseReport._id.toString() })
      .send([
        { description: 'Imported Hotel', cost: createBulkCost(100, 'EUR', new Date('2023-09-15T00:00:00.000Z')) },
        { cost: createBulkCost(16.9, 'USD', new Date('2023-09-16T00:00:00.000Z')) }
      ])
    t.is(bulkResponse.status, 422)

    const reportResponse = await agent
      .get('/examine/expenseReport')
      .query({ _id: tempExpenseReport._id.toString(), additionalFields: ['expenses'] })
    t.is(reportResponse.status, 200)
    t.is((reportResponse.body.data as ExpenseReport).expenses.length, 1)
  } finally {
    if (tempExpenseReport?._id) {
      await loginUser(agent, 'expenseReport')
      const deleteResponse = await agent.delete('/examine/expenseReport').query({ _id: tempExpenseReport._id.toString() })
      t.is(deleteResponse.status, 200)
    }

    await loginUser(agent, 'user')
  }
})

// FILL OUT

test.serial('POST /expenseReport/expense requires descriptions for split positions', async (t) => {
  const cost = createCost(100, { _id: 'EUR' }, new Date('2023-09-14T00:00:00.000Z'))
  cost.positions.push({ ...cost.positions[0], grossAmount: 21 })
  const res = await postMultipartExpense('/expenseReport/expense', expenseReport._id.toString(), { description: 'Split expense', cost })
  t.is(res.status, 422)
})

const expenses = [
  () => ({ description: 'English Course', cost: createCost(82, { _id: 'GBP' }, new Date('2023-09-14T00:00:00.000Z')) }),
  () => ({
    description: 'Dinner with customer',
    cost: createCost(700, { _id: 'CNY' }, new Date('2023-09-13T00:00:00.000Z'), [
      { name: 'Photo.jpg', type: 'image/jpeg', data: 'tests/files/dummy.jpg' },
      { name: 'Photo2.jpg', type: 'image/jpeg', data: 'tests/files/small-dummy.jpg' }
    ])
  })
]

test.serial('POST /expenseReport/expense', async (t) => {
  t.plan(expenses.length + 0)
  for (const createExpense of expenses) {
    const expense = createExpense()
    const res = await postMultipartExpense('/expenseReport/expense', expenseReport._id.toString(), expense)
    if (res.status === 200) {
      expenseReport = res.body.result
      t.pass()
    } else {
      console.log(res.body)
    }
  }
})

test.serial('POST /expenseReport/underExamination rejects incomplete expense', async (t) => {
  const res = await agent.post('/expenseReport/underExamination').send({ _id: expenseReport._id })
  t.is(res.status, 422)
})

test.serial('POST /expenseReport/expense adds missing receipt', async (t) => {
  t.plan(3)
  const expenseWithoutReceipt = (expenseReport as ExpenseReport).expenses.find((expense) => expense.cost.receipts.length === 0)
  t.truthy(expenseWithoutReceipt, 'Expected an expense without a receipt in the seeded expense report')
  if (!expenseWithoutReceipt) {
    return
  }

  const updatedExpense = {
    _id: expenseWithoutReceipt._id,
    description: expenseWithoutReceipt.description,
    note: expenseWithoutReceipt.note,
    cost: createCost(
      expenseWithoutReceipt.cost.positions[0].grossAmount,
      { _id: expenseWithoutReceipt.cost.currency._id },
      new Date(expenseWithoutReceipt.cost.date || 0),
      [{ name: 'Online Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }]
    )
  }

  const res = await postMultipartExpense('/expenseReport/expense', expenseReport._id.toString(), updatedExpense)
  if (res.status === 200) {
    expenseReport = res.body.result
    t.pass()
  } else {
    console.log(res.body)
    t.fail()
  }
  t.true((res.body.result as ExpenseReport).expenses.every((expense) => expense.cost.receipts.length > 0))
})

test.serial('POST /expenseReport/underExamination', async (t) => {
  t.plan(4)
  const comment = "A quite long comment but this doesn't matter because mongoose has no limit."
  const res = await agent.post('/expenseReport/underExamination').send({ _id: expenseReport._id, comment })
  if (res.status === 200) {
    expenseReport = res.body.result
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as ExpenseReport).state, ExpenseReportState.IN_REVIEW)
  t.is((res.body.result as ExpenseReport).history.length, 1)
  t.like((res.body.result as ExpenseReport).comments[0], { text: comment, toState: ExpenseReportState.IN_REVIEW })
})

test.serial('POST /expenseReport/inWork AGAIN', async (t) => {
  t.plan(4)
  const comment = ''
  const res = await agent.post('/expenseReport/inWork').send({ _id: expenseReport._id, comment })
  if (res.status === 200) {
    expenseReport = res.body.result
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as ExpenseReport).state, ExpenseReportState.IN_WORK)
  t.is((res.body.result as ExpenseReport).history.length, 2)
  t.is((res.body.result as ExpenseReport).comments.length, 1)
})

test.serial('POST /expenseReport/underExamination AGAIN', async (t) => {
  t.plan(3)
  const res = await agent.post('/expenseReport/underExamination').send({ _id: expenseReport._id })
  if (res.status === 200) {
    expenseReport = res.body.result
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as ExpenseReport).state, ExpenseReportState.IN_REVIEW)
  t.is((res.body.result as ExpenseReport).history.length, 3)
})

// EXAMINE

test.serial('POST /examine/expenseReport/expense', async (t) => {
  await loginUser(agent, 'expenseReport')
  t.plan(2)
  const expense = (expenseReport as ExpenseReport).expenses[0]
  const expenseBody = {
    _id: expense._id,
    description: expense.description,
    note: expense.note,
    cost: createCost(
      expense.cost.positions[0].grossAmount,
      { _id: expense.cost.currency._id },
      new Date(expense.cost.date || 0),
      expense.cost.receipts
    )
  }
  let req = agent.post('/examine/expenseReport/expense').query({ parentId: expenseReport._id.toString() })
  for (const entry of objectToFormFields(expenseBody)) {
    req = req.field(entry.field, entry.val)
  }
  const res = await req
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as ExpenseReport).expenses[0].cost.receipts.length, 2)
})

test.serial('POST /examine/expenseReport/reviewCompleted', async (t) => {
  await loginUser(agent, 'expenseReport')
  t.plan(3)
  const comment = '' // empty string should not create comment
  const res = await agent.post('/examine/expenseReport/reviewCompleted').send({ _id: expenseReport._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as ExpenseReport).state, ExpenseReportState.REVIEW_COMPLETED)
  t.is((res.body.result as ExpenseReport).history.length, 4)
})

// REPORT

test.serial('GET /expenseReport/report', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.get('/expenseReport/report').query({ _id: expenseReport._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

// BOOK

test.serial('POST /book/expenseReport/bookingExportPackage', async (t) => {
  const organisation = await Organisation.findById(idDocumentToId(expenseReport.project.organisation)).lean()
  t.truthy(organisation)
  if (!organisation) return
  const originalLiabilityAccount = idDocumentToId(organisation.accountingSettings.employeeLiabilitiesAccount)
  const replacementLiabilityAccount = await LedgerAccount.create({
    identifier: `liability-${new Types.ObjectId()}`,
    name: 'Updated employee liabilities'
  })
  await Organisation.updateOne(
    { _id: organisation._id },
    { $set: { 'accountingSettings.employeeLiabilitiesAccount': replacementLiabilityAccount._id } }
  )

  await User.updateOne({ _id: expenseReport.owner._id }, { $set: { employeeId: 'E-1' } })
  await loginUser(agent, 'expenseReport')
  const res = await requestBookingExport(agent, '/book/expenseReport', [expenseReport._id], { includeBankBookings: true })
  t.is(res.status, 200)
  const bookings = res.body.result.bookings as BookingExportRow[]
  assertBookingsBalanced(t, bookings, 'ExpenseReport')
  t.true(bookings.every(({ employee }) => employee.employeeId === 'E-1'))
  t.is(res.body.result.sepaFiles.length, 1)
  const bankBookings = bookings.filter(({ remark }) => remark?.startsWith('SEPA '))
  t.is(bankBookings.length, 2)
  t.deepEqual(
    bankBookings.map(({ side, ledgerAccount }) => ({ side, account: ledgerAccount.identifier })),
    [
      { side: 'debit', account: replacementLiabilityAccount.identifier },
      { side: 'credit', account: '1200' }
    ]
  )
  await Organisation.updateOne(
    { _id: organisation._id },
    { $set: { 'accountingSettings.employeeLiabilitiesAccount': originalLiabilityAccount } }
  )

  const validPreview = await agent.post('/book/expenseReport/bookingExportPreview').send([expenseReport._id])
  const foreignAccountResponse = await agent
    .post('/book/expenseReport/bookingExportPackage')
    .send({
      reports: [expenseReport._id],
      executionDate: '2026-08-01',
      bankAccounts: [{ organisation: validPreview.body.result.organisations[0]._id, account: '507f1f77bcf86cd799439011' }]
    })
  t.is(foreignAccountResponse.status, 422)

  const invalidDateResponse = await agent
    .post('/book/expenseReport/bookingExportPackage')
    .send({ reports: [expenseReport._id], executionDate: '2026-02-30', bankAccounts: [] })
  t.is(invalidDateResponse.status, 422)

  await User.updateOne({ _id: expenseReport.owner._id }, { $unset: { 'settings.bankAccount': '' } })
  const missingBankPreview = await agent.post('/book/expenseReport/bookingExportPreview').send([expenseReport._id])
  t.is(missingBankPreview.status, 200)
  t.true(missingBankPreview.body.result.errors.some((error: string) => error.startsWith('missingEmployeeBankAccount:')))
  const incompletePackage = await agent
    .post('/book/expenseReport/bookingExportPackage')
    .send({ reports: [expenseReport._id], executionDate: '2026-08-01', bankAccounts: [] })
  t.is(incompletePackage.status, 422)
})

test.serial('bookable expense report uses a valid manual VAT amount override', async (t) => {
  await loginUser(agent, 'user')
  const createResponse = await agent.post('/expenseReport/inWork').send({ name: 'Adjusted VAT report', project: expenseReport.project })
  t.is(createResponse.status, 200)
  const adjustedVatReport = createResponse.body.result as ExpenseReportSimple

  try {
    const cost = createCost(119, { _id: 'EUR' }, new Date('2026-07-01T00:00:00.000Z'), [
      { name: 'Adjusted VAT.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }
    ])
    const position = cost.positions[0] as (typeof cost.positions)[number] & { vatAmountOverride?: number }
    position.vatRate = 19
    position.vatAmountOverride = 119.01
    const invalidExpenseResponse = await postMultipartExpense('/expenseReport/expense', adjustedVatReport._id.toString(), {
      description: 'Invalid adjusted VAT',
      cost
    })
    t.is(invalidExpenseResponse.status, 422)

    position.vatAmountOverride = 18.99
    const expenseResponse = await postMultipartExpense('/expenseReport/expense', adjustedVatReport._id.toString(), {
      description: 'Adjusted VAT',
      cost
    })
    t.is(expenseResponse.status, 200)
    t.is((expenseResponse.body.result as ExpenseReport).expenses[0].cost.positions[0].vatAmountOverride, 18.99)
    t.is((await agent.post('/expenseReport/underExamination').send({ _id: adjustedVatReport._id })).status, 200)

    await loginUser(agent, 'expenseReport')
    t.is((await agent.post('/examine/expenseReport/reviewCompleted').send({ _id: adjustedVatReport._id })).status, 200)
    const exportResponse = await requestBookingExport(agent, '/book/expenseReport', [adjustedVatReport._id])
    t.is(exportResponse.status, 200)
    const bookings = exportResponse.body.result.bookings as BookingExportRow[]
    assertBookingsBalanced(t, bookings, 'ExpenseReport')
    t.deepEqual(
      bookings
        .filter(({ side }) => side === 'debit')
        .map(({ amount }) => amount)
        .sort((left, right) => left - right),
      [18.99, 100.01]
    )
    t.deepEqual(
      bookings.filter(({ side }) => side === 'credit').map(({ amount }) => amount),
      [119]
    )
  } finally {
    await loginUser(agent, 'user')
    const deleteResponse = await agent.delete('/expenseReport').query({ _id: adjustedVatReport._id.toString() })
    t.is(deleteResponse.status, 200)
  }
})

test.serial('bookable expense report reverses negative net and VAT totals', async (t) => {
  await loginUser(agent, 'user')
  const createResponse = await agent.post('/expenseReport/inWork').send({ name: 'Negative VAT report', project: expenseReport.project })
  t.is(createResponse.status, 200)
  const negativeReport = createResponse.body.result as ExpenseReportSimple

  try {
    const cost = createCost(-119, { _id: 'EUR' }, new Date('2026-07-01T00:00:00.000Z'), [
      { name: 'Credit note.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }
    ])
    cost.positions[0].vatRate = 19
    const expenseResponse = await postMultipartExpense('/expenseReport/expense', negativeReport._id.toString(), {
      description: 'Credit note',
      cost
    })
    t.is(expenseResponse.status, 200)
    t.is((await agent.post('/expenseReport/underExamination').send({ _id: negativeReport._id })).status, 200)

    await loginUser(agent, 'expenseReport')
    t.is((await agent.post('/examine/expenseReport/reviewCompleted').send({ _id: negativeReport._id })).status, 200)
    const exportResponse = await requestBookingExport(agent, '/book/expenseReport', [negativeReport._id])
    t.is(exportResponse.status, 200)
    const bookings = exportResponse.body.result.bookings as BookingExportRow[]
    t.deepEqual(exportResponse.body.result.sepaFiles, [])
    assertBookingsBalanced(t, bookings, 'ExpenseReport')
    t.deepEqual(
      bookings
        .filter(({ side }) => side === 'credit')
        .map(({ amount }) => amount)
        .sort((left, right) => left - right),
      [19, 100]
    )
    t.deepEqual(
      bookings.filter(({ side }) => side === 'debit').map(({ amount }) => amount),
      [119]
    )
  } finally {
    await loginUser(agent, 'user')
    const deleteResponse = await agent.delete('/expenseReport').query({ _id: negativeReport._id.toString() })
    t.is(deleteResponse.status, 200)
  }
})

test.serial('POST /book/expenseReport/booked', async (t) => {
  await loginUser(agent, 'expenseReport')
  t.plan(2)
  const res = await agent.post('/book/expenseReport/booked').send([expenseReport._id])
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is(res.body.result[0].status, 'fulfilled')
})

test.after.always('DELETE /expenseReport', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.delete('/expenseReport').query({ _id: expenseReport._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
