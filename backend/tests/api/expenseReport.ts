import { Expense, ExpenseReport, ExpenseReportSimple, ExpenseReportState } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

//@ts-expect-error
let expenseReport: ExpenseReportSimple = { name: 'Expenses from last Month' }

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

// FILL OUT

const expenses: Expense[] = [
  {
    description: 'English Course',
    cost: {
      amount: 82, //@ts-ignore
      currency: { _id: 'GBP' }, //@ts-ignore
      receipts: [{ name: 'Online Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
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
    let req = agent.post('/expenseReport/expense').query({ parentId: expenseReport._id.toString() })
    for (const entry of objectToFormFields(expense)) {
      if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
        req = req.attach(entry.field, entry.val)
      } else {
        req = req.field(entry.field, entry.val)
      }
    }
    const res = await req
    if (res.status === 200) {
      t.pass()
    } else {
      console.log(res.body)
    }
  }
})

test.serial('POST /expenseReport/underExamination', async (t) => {
  t.plan(4)
  const comment = "A quite long comment but this doesn't matter because mongoose has no limit."
  const res = await agent.post('/expenseReport/underExamination').send({ _id: expenseReport._id, comment })
  if (res.status === 200) {
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
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as ExpenseReport).state, ExpenseReportState.IN_REVIEW)
  t.is((res.body.result as ExpenseReport).history.length, 3)
})

// EXAMINE

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
