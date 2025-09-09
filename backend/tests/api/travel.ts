import { Stage, Travel, TravelExpense, TravelSimple, TravelState } from 'abrechnung-common/types.js'
import test from 'ava'
import { disconnectDB } from '../../db.js'
import createAgent, { loginUser } from '../_agent.js'
import { objectToFormFields } from '../_helper.js'

const agent = await createAgent()
await loginUser(agent, 'user')

let travel: TravelSimple = {
  name: 'Ankara Aug 2023',
  reason: 'Fortbildung',
  destinationPlace: {
    //@ts-expect-error
    country: { _id: 'TR' },
    place: 'Ankara'
  },
  startDate: new Date('2023-08-24T00:00:00.000Z'),
  endDate: new Date('2023-09-02T00:00:00.000Z')
}

test.serial('GET /project', async (t) => {
  const res = await agent.get('/project')
  travel.project = res.body.data[0]
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('POST /travel/appliedFor', async (t) => {
  const res = await agent.post('/travel/appliedFor').send(travel)
  travel = res.body.result
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /travel', async (t) => {
  t.plan(2)
  const res = await agent.get('/travel')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  for (const gotTravel of res.body.data as TravelSimple[]) {
    if (travel._id === gotTravel._id) {
      t.pass()
      break
    }
  }
})

// APPROVE

test.serial('GET /approve/travel', async (t) => {
  await loginUser(agent, 'travel')
  t.plan(2)
  const res = await agent.get('/approve/travel')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  for (const gotTravel of res.body.data as TravelSimple[]) {
    if (travel._id === gotTravel._id) {
      t.pass()
      break
    }
  }
})

test.serial('POST /approve/travel/approved', async (t) => {
  t.plan(4)
  const comment = 'A Comment'
  const res = await agent.post('/approve/travel/approved').send({ _id: travel._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as Travel).state, TravelState.APPROVED)
  t.is((res.body.result as Travel).history.length, 1)
  t.like((res.body.result as Travel).comments[0], { text: comment, toState: TravelState.APPROVED })
})

// FILL OUT

const stages: Stage[] = [
  {
    departure: new Date('2023-08-24T14:05:00.000Z'),
    arrival: new Date('2023-08-24T19:30:00.000Z'),
    startLocation: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Frankfurt'
    },
    endLocation: {
      //@ts-expect-error
      country: { _id: 'TR' },
      place: 'Ankara'
    },
    midnightCountries: [],
    transport: { type: 'airplane' },
    cost: {
      amount: 652, //@ts-ignore
      currency: { _id: 'USD' }, //@ts-ignore
      receipts: [{ name: 'Online Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
      date: new Date('2023-08-04T00:00:00.000Z')
    },
    purpose: 'professional'
  },
  {
    departure: new Date('2023-08-29T11:30:00.000Z'),
    arrival: new Date('2023-08-29T14:05:00.000Z'),
    startLocation: {
      //@ts-expect-error
      country: { _id: 'TR' },
      place: 'Ankara'
    },
    endLocation: {
      //@ts-expect-error
      country: { _id: 'BG' },
      place: 'Sofia'
    },
    midnightCountries: [],
    transport: { type: 'airplane' }, //@ts-ignore
    cost: {
      amount: null, //@ts-ignore
      currency: { _id: 'EUR' }
    },
    purpose: 'professional'
  },
  {
    departure: new Date('2023-09-01T14:05:00.000Z'),
    arrival: new Date('2023-09-01T18:34:00.000Z'),
    startLocation: {
      //@ts-expect-error
      country: { _id: 'BG' },
      place: 'Sofia'
    },
    endLocation: {
      //@ts-expect-error
      country: { _id: 'DE' },
      place: 'Frankfurt'
    },
    midnightCountries: [],
    transport: { type: 'airplane' }, //@ts-ignore
    cost: {
      amount: null, //@ts-ignore
      currency: { _id: 'EUR' }
    },
    purpose: 'professional'
  }
]

test.serial('POST /travel/stage', async (t) => {
  await loginUser(agent, 'user')
  t.plan(stages.length + 0)
  for (const stage of stages) {
    let req = agent.post('/travel/stage').query({ parentId: travel._id.toString() })
    for (const entry of objectToFormFields(stage)) {
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

const expenses: TravelExpense[] = [
  {
    description: 'Konferenzkosten',
    cost: {
      amount: 82, //@ts-ignore
      currency: { _id: 'TRY' }, //@ts-ignore
      receipts: [{ name: 'Photo.png', type: 'image/png', data: 'tests/files/dummy.png' }],
      date: new Date('2023-08-07T00:00:00.000Z')
    },
    purpose: 'professional'
  }
]

test.serial('POST /travel/expense', async (t) => {
  t.plan(expenses.length + 0)
  for (const expense of expenses) {
    let req = agent.post('/travel/expense').query({ parentId: travel._id.toString() })
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

test.serial('POST /travel/underExamination', async (t) => {
  t.plan(4)
  const comment = "A quite long comment but this doesn't matter because mongoose has no limit."
  const res = await agent.post('/travel/underExamination').send({ _id: travel._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as Travel).state, TravelState.IN_REVIEW)
  t.is((res.body.result as Travel).history.length, 2)
  t.like((res.body.result as Travel).comments[1], { text: comment, toState: TravelState.IN_REVIEW })
})

test.serial('POST /travel/approved AGAIN', async (t) => {
  t.plan(3)
  const res = await agent.post('/travel/approved').send({ _id: travel._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as Travel).state, TravelState.APPROVED)
  t.is((res.body.result as Travel).history.length, 3)
})

test.serial('POST /travel/underExamination AGAIN', async (t) => {
  t.plan(3)
  const res = await agent.post('/travel/underExamination').send({ _id: travel._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as Travel).state, TravelState.IN_REVIEW)
  t.is((res.body.result as Travel).history.length, 4)
})

// EXAMINE

test.serial('POST /examine/travel/reviewCompleted', async (t) => {
  await loginUser(agent, 'travel')
  t.plan(4)
  const comment = '' // empty string should not create comment
  const res = await agent.post('/examine/travel/reviewCompleted').send({ _id: travel._id, comment })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as Travel).state, TravelState.REVIEW_COMPLETED)
  t.is((res.body.result as Travel).history.length, 5)
  t.is((res.body.result as Travel).comments.length, 2)
})

// REPORT

test.serial('GET /travel/report', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.get('/travel/report').query({ _id: travel._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

// BOOK

test.serial('POST /book/travel/booked', async (t) => {
  await loginUser(agent, 'travel')
  t.plan(2)
  const res = await agent.post('/book/travel/booked').send([travel._id])
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is(res.body.result[0].status, 'fulfilled')
})

test.after.always('DELETE /travel', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.delete('/travel').query({ _id: travel._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial.after.always('Drop DB Connection', async () => {
  await disconnectDB()
})
