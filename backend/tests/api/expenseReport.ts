import test from 'ava'
import { Expense, ExpenseReport, ExpenseReportSimple } from '../../../common/types.js'
import createAgent, { loginUser } from './_agent.js'
import { objectToFormFields } from './_helper.js'

const agent = await createAgent()
await loginUser(agent, 'user')

//@ts-ignore
var expenseReport: ExpenseReportSimple = {
  name: 'Expenses from last Month'
}

test.serial('GET /organisation', async (t) => {
  const res = await agent.get('/api/organisation')
  expenseReport.organisation = res.body.data[0]
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('POST /expenseReport/inWork', async (t) => {
  const res = await agent.post('/api/expenseReport/inWork').send(expenseReport)
  expenseReport = res.body.result
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /expenseReport', async (t) => {
  t.plan(2)
  const res = await agent.get('/api/expenseReport')
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
        //@ts-ignore
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
    var req = agent.post('/api/expenseReport/expense')
    for (const entry of objectToFormFields(expense)) {
      if (entry.field.length > 6 && entry.field.slice(-6) == '[data]') {
        req = req.attach(entry.field, entry.val)
      } else {
        req = req.field(entry.field, entry.val)
      }
    }
    const res = await req.field('expenseReportId', expenseReport._id.toString())
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
  const res = await agent.post('/api/expenseReport/underExamination').send({ _id: expenseReport._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as ExpenseReport).state, 'underExamination')
  t.is((res.body.result as ExpenseReport).history.length, 1)
  t.like((res.body.result as ExpenseReport).comments[0], { text: comment, toState: 'underExamination' })
})

// EXAMINE

test.serial('POST /examine/expenseReport/refunded', async (t) => {
  await loginUser(agent, 'expenseReport')
  t.plan(4)
  const comment = '' // empty string should not create comment
  const res = await agent.post('/api/examine/expenseReport/refunded').send({ _id: expenseReport._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as ExpenseReport).state, 'refunded')
  t.is((res.body.result as ExpenseReport).history.length, 2)
  t.is((res.body.result as ExpenseReport).comments.length, 1)
})

// REPORT

test.serial('GET /expenseReport/report', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.get('/api/expenseReport/report').query({ id: expenseReport._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.after.always('DELETE /expenseReport', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.delete('/api/expenseReport').query({ id: expenseReport._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})
