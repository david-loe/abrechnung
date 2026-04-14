import { Expense, ExpenseReport, ExpenseReportSimple, ExpenseReportState } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

//@ts-expect-error
let expenseReport: ExpenseReportSimple = { name: 'Expenses from last Month' }

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
  expenseReport.category = res.body.data[0]
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
    const tempReportResponse = await agent
      .post('/expenseReport/inWork')
      .send({ name: 'Bulk Import Test', project: expenseReport.project, category: expenseReport.category })
    t.is(tempReportResponse.status, 200)

    tempExpenseReport = tempReportResponse.body.result as ExpenseReportSimple
    const bulkExpenses: Partial<Expense>[] = [
      {
        description: 'Imported Taxi',
        cost: {
          amount: 28.4,
          currency: { _id: 'EUR', name: { de: 'Euro', en: 'Euro', fr: 'Euro', ru: 'Euro', es: 'Euro', kk: 'Euro' } },
          receipts: [],
          date: new Date('2023-09-10T00:00:00.000Z')
        }
      },
      {
        description: 'Imported Meal',
        cost: {
          amount: 16.9,
          currency: {
            _id: 'USD',
            name: {
              de: 'US-Dollar',
              en: 'US Dollar',
              fr: 'Dollar americain',
              ru: 'Доллар США',
              es: 'Dolar estadounidense',
              kk: 'АКШ доллары'
            }
          },
          receipts: [],
          date: new Date('2023-09-11T00:00:00.000Z')
        },
        note: 'Imported from CSV'
      }
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
    const tempReportResponse = await agent
      .post('/expenseReport/inWork')
      .send({ name: 'Bulk Atomic Test', project: expenseReport.project, category: expenseReport.category })
    t.is(tempReportResponse.status, 200)

    tempExpenseReport = tempReportResponse.body.result as ExpenseReportSimple
    const bulkResponse = await agent
      .post('/expenseReport/expense/bulk')
      .query({ parentId: tempExpenseReport._id.toString() })
      .send([
        { description: 'Imported Taxi', cost: { amount: 28.4, currency: { _id: 'EUR' }, date: new Date('2023-09-10T00:00:00.000Z') } },
        { cost: { amount: 16.9, currency: { _id: 'USD' }, date: new Date('2023-09-11T00:00:00.000Z') }, note: 'Imported from CSV' }
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
      .send({ name: 'Foreign Receipt Source', project: expenseReport.project, category: expenseReport.category })
    t.is(foreignReportResponse.status, 200)

    foreignReport = foreignReportResponse.body.result as ExpenseReportSimple
    const foreignExpense = {
      description: 'Foreign Receipt Expense',
      cost: {
        amount: 12,
        currency: { _id: 'EUR' },
        receipts: [{ name: 'Foreign Receipt.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
        date: new Date('2023-09-12T00:00:00.000Z')
      }
    }

    const foreignExpenseResponse = await postMultipartExpense('/expenseReport/expense', foreignReport._id.toString(), foreignExpense)
    t.is(foreignExpenseResponse.status, 200)

    const foreignReceiptId = (foreignExpenseResponse.body.result as ExpenseReport).expenses[0].cost.receipts[0]._id

    await loginUser(agent, 'user')
    const targetReportResponse = await agent
      .post('/expenseReport/inWork')
      .send({ name: 'Bulk Receipt Target', project: expenseReport.project, category: expenseReport.category })
    t.is(targetReportResponse.status, 200)

    targetReport = targetReportResponse.body.result as ExpenseReportSimple
    const bulkResponse = await agent
      .post('/expenseReport/expense/bulk')
      .query({ parentId: targetReport._id.toString() })
      .send([
        {
          description: 'Imported Expense',
          cost: { amount: 42, currency: { _id: 'EUR' }, receipts: [{ _id: foreignReceiptId }], date: new Date('2023-09-13T00:00:00.000Z') }
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
      .send({ name: 'Examine Bulk Atomic Test', project: expenseReport.project, category: expenseReport.category })
    t.is(tempReportResponse.status, 200)

    tempExpenseReport = tempReportResponse.body.result as ExpenseReportSimple
    const initialExpense = {
      description: 'Initial Expense',
      cost: {
        amount: 82,
        currency: { _id: 'GBP' },
        receipts: [{ name: 'Online Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
        date: new Date('2023-09-14T00:00:00.000Z')
      }
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
        { description: 'Imported Hotel', cost: { amount: 100, currency: { _id: 'EUR' }, date: new Date('2023-09-15T00:00:00.000Z') } },
        { cost: { amount: 16.9, currency: { _id: 'USD' }, date: new Date('2023-09-16T00:00:00.000Z') } }
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

const expenses: Expense[] = [
  {
    description: 'English Course',
    cost: {
      amount: 82, //@ts-ignore
      currency: { _id: 'GBP' }, //@ts-ignore
      receipts: [],
      date: new Date('2023-09-14T00:00:00.000Z')
    }
  },
  {
    description: 'Dinner with customer',
    cost: {
      amount: 700, //@ts-ignore
      currency: { _id: 'CNY' },
      receipts: [
        //@ts-expect-error
        { name: 'Photo.jpg', type: 'image/jpeg', data: 'tests/files/dummy.jpg' }, //@ts-ignore
        { name: 'Photo2.jpg', type: 'image/jpeg', data: 'tests/files/small-dummy.jpg' }
      ],
      date: new Date('2023-09-13T00:00:00.000Z')
    }
  }
]

test.serial('POST /expenseReport/expense', async (t) => {
  t.plan(expenses.length + 0)
  for (const expense of expenses) {
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
    ...expenseWithoutReceipt,
    cost: {
      ...expenseWithoutReceipt.cost,
      receipts: [{ name: 'Online Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }]
    }
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
  let req = agent.post('/examine/expenseReport/expense').query({ parentId: expenseReport._id.toString() })
  for (const entry of objectToFormFields((expenseReport as ExpenseReport).expenses[0])) {
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
