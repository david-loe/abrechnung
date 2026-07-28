import { BookingExportRow, Category, HealthCareCost, HealthCareCostSimple, HealthCareCostState } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import createAgent, { loginUser } from '../_agent.js'
import { assertBookingsBalanced } from '../_booking.js'

const agent = await createAgent()
await loginUser(agent, 'user')

//@ts-expect-error
let healthCareCost: HealthCareCostSimple = { name: 'Broken leg', patientName: 'Ben Logas' }
let category: Category

test.serial('GET /healthInsurance', async (t) => {
  const res = await agent.get('/healthInsurance')
  healthCareCost.insurance = res.body.data[0]
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /project', async (t) => {
  const res = await agent.get('/project')
  healthCareCost.project = res.body.data[0]
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /category', async (t) => {
  const res = await agent.get('/category')
  category = res.body.data.find(({ for: value }: Category) => value === 'ExpenseReport' || value === 'both')
  t.is(res.status, 200)
})

test.serial('POST /healthCareCost/inWork', async (t) => {
  const res = await agent.post('/healthCareCost/inWork').send(healthCareCost)
  healthCareCost = res.body.result
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /healthCareCost', async (t) => {
  t.plan(2)
  const res = await agent.get('/healthCareCost')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  for (const gotHealthCareCost of res.body.data as HealthCareCostSimple[]) {
    if (healthCareCost._id === gotHealthCareCost._id) {
      t.pass()
      break
    }
  }
})

test.serial('POST /healthCareCost/underExamination rejects incomplete health care cost', async (t) => {
  const res = await agent.post('/healthCareCost/underExamination').send({ _id: healthCareCost._id })
  t.is(res.status, 422)
})

// FILL OUT

const expenses = [
  {
    description: 'Fist medical examination',
    amount: 172,
    currency: { _id: 'GBP' },
    receipts: [{ name: 'Medical Center Invoice-82878903.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
    date: new Date('2023-10-18T00:00:00.000Z')
  },
  {
    description: 'Application of Cast',
    amount: 480.62,
    currency: { _id: 'USD' },
    receipts: [
      { name: 'Photo.jpg', type: 'image/png', data: 'tests/files/dummy.png' },
      { name: 'Photo2.jpg', type: 'image/png', data: 'tests/files/small-dummy.png' }
    ],
    date: new Date('2023-09-13T00:00:00.000Z')
  }
]

test.serial('POST /healthCareCost/expense', async (t) => {
  t.plan(expenses.length + 0)
  for (const expense of expenses) {
    const expenseBody = {
      description: expense.description,
      cost: {
        positions: [
          {
            kind: 'manual',
            description: expense.description,
            grossAmount: expense.amount,
            vatRate: 0,
            project: healthCareCost.project,
            category
          }
        ],
        currency: expense.currency,
        receipts: expense.receipts,
        date: expense.date
      }
    }
    let req = agent.post('/healthCareCost/expense').query({ parentId: healthCareCost._id.toString() })
    for (const entry of objectToFormFields(expenseBody)) {
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

test.serial('POST /healthCareCost/underExamination', async (t) => {
  t.plan(4)
  const comment = "A quite long comment but this doesn't matter because mongoose has no limit."
  const res = await agent.post('/healthCareCost/underExamination').send({ _id: healthCareCost._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as HealthCareCost).state, HealthCareCostState.IN_REVIEW)
  t.is((res.body.result as HealthCareCost).history.length, 1)
  t.like((res.body.result as HealthCareCost).comments[0], { text: comment, toState: HealthCareCostState.IN_REVIEW })
})

// EXAMINE

test.serial('POST /examine/healthCareCost/inWork AGAIN', async (t) => {
  await loginUser(agent, 'healthCareCost')
  t.plan(4)
  const comment = 'back to inWork'
  const res = await agent.post('/examine/healthCareCost/inWork').send({ _id: healthCareCost._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as HealthCareCost).state, HealthCareCostState.IN_WORK)
  t.is((res.body.result as HealthCareCost).history.length, 2)
  t.like((res.body.result as HealthCareCost).comments[1], { text: comment, toState: HealthCareCostState.IN_WORK })
})

// USER

test.serial('POST /healthCareCost/underExamination AGAIN', async (t) => {
  await loginUser(agent, 'user')
  t.plan(3)
  const res = await agent.post('/healthCareCost/underExamination').send({ _id: healthCareCost._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as HealthCareCost).state, HealthCareCostState.IN_REVIEW)
  t.is((res.body.result as HealthCareCost).history.length, 3)
})

// EXAMINE

test.serial('POST /examine/healthCareCost/reviewCompleted', async (t) => {
  await loginUser(agent, 'healthCareCost')
  t.plan(4)
  const comment = '' // empty string should not create comment
  const res = await agent.post('/examine/healthCareCost/reviewCompleted').send({ _id: healthCareCost._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as HealthCareCost).state, HealthCareCostState.REVIEW_COMPLETED)
  t.is((res.body.result as HealthCareCost).history.length, 4)
  t.is((res.body.result as HealthCareCost).comments.length, 2)
})

// REPORT

test.serial('GET /healthCareCost/report', async (t) => {
  t.timeout(20_000) // 20 seconds
  await loginUser(agent, 'user')
  const res = await agent.get('/healthCareCost/report').query({ _id: healthCareCost._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

// BOOK

test.serial('POST /book/healthCareCost/bookingExport', async (t) => {
  await loginUser(agent, 'healthCareCost')
  const res = await agent.post('/book/healthCareCost/bookingExport').send([healthCareCost._id])
  t.is(res.status, 200)
  assertBookingsBalanced(t, res.body.result as BookingExportRow[], 'HealthCareCost')
})

test.serial('POST /book/healthCareCost/booked', async (t) => {
  await loginUser(agent, 'healthCareCost')
  t.plan(2)
  const res = await agent.post('/book/healthCareCost/booked').send([healthCareCost._id])
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is(res.body.result[0].status, 'fulfilled')
})

test.after.always('DELETE /healthCareCost', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.delete('/healthCareCost').query({ _id: healthCareCost._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
