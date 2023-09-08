import test from 'ava'
import { Expense, Stage, Travel, TravelSimple } from '../../../common/types.js'
import createAgent, { loginApprove, loginExamine, loginUser } from './_agent.js'
import { setStrokingGrayscaleColor } from 'pdf-lib'

const agent = createAgent()
await loginUser(agent)

var travel: TravelSimple = {
  name: 'Ankara Aug 2023',
  reason: 'Fortbildung',
  destinationPlace: {
    //@ts-ignore
    country: { _id: 'TR' },
    place: 'Ankara'
  },
  travelInsideOfEU: false,
  startDate: new Date('2023-08-24T00:00:00.000Z'),
  endDate: new Date('2023-09-02T00:00:00.000Z'),
  advance: {
    amount: null, //@ts-ignore
    currency: { _id: 'EUR' },
    exchangeRate: null
  }
}

test.serial('POST /travel/appliedFor', async (t) => {
  const res = await agent.post('/api/travel/appliedFor').send(travel)
  travel = res.body.result
  t.is(res.status, 200)
})

test.serial('GET /travel', async (t) => {
  t.plan(2)
  const res = await agent.get('/api/travel')
  t.is(res.status, 200)
  for (const gotTravel of res.body.data as TravelSimple[]) {
    if (travel._id === gotTravel._id) {
      t.pass()
      break
    }
  }
})

// APPROVE

test.serial('GET /approve/travel', async (t) => {
  await loginApprove(agent)
  t.plan(2)
  const res = await agent.get('/api/approve/travel')
  t.is(res.status, 200)
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
  const res = await agent.post('/api/approve/travel/approved').send({ _id: travel._id, comment })
  t.is(res.status, 200)
  t.is((res.body.result as Travel).state, 'approved')
  t.is((res.body.result as Travel).history.length, 1)
  t.like((res.body.result as Travel).comments[0], { text: comment, toState: 'approved' })
})

// FILL OUT

const stages: Stage[] = [
  {
    departure: new Date('2023-08-24T14:05:00.000Z'),
    arrival: new Date('2023-08-24T19:30:00.000Z'),
    startLocation: {
      //@ts-ignore
      country: { _id: 'DE' },
      place: 'Frankfurt'
    },
    endLocation: {
      //@ts-ignore
      country: { _id: 'TR' },
      place: 'Ankara'
    },
    midnightCountries: [],
    transport: 'airplane',
    cost: {
      amount: 652, //@ts-ignore
      currency: { _id: 'USD' },
      receipts: [],
      date: new Date('2023-08-04T00:00:00.000Z')
    },
    purpose: 'professional'
  },
  {
    departure: new Date('2023-08-29T11:30:00.000Z'),
    arrival: new Date('2023-08-29T14:05:00.000Z'),
    startLocation: {
      //@ts-ignore
      country: { _id: 'TR' },
      place: 'Ankara'
    },
    endLocation: {
      //@ts-ignore
      country: { _id: 'BG' },
      place: 'Sofia'
    },
    midnightCountries: [],
    transport: 'airplane', //@ts-ignore
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
      //@ts-ignore
      country: { _id: 'BG' },
      place: 'Sofia'
    },
    endLocation: {
      //@ts-ignore
      country: { _id: 'DE' },
      place: 'Frankfurt'
    },
    midnightCountries: [],
    transport: 'airplane', //@ts-ignore
    cost: {
      amount: null, //@ts-ignore
      currency: { _id: 'EUR' }
    },
    purpose: 'professional'
  }
]

test.serial('POST /travel/stage', async (t) => {
  await loginUser(agent)
  t.plan(stages.length + 0)
  for (const stage of stages) {
    const res = await agent.post('/api/travel/stage').send(Object.assign(stage, { travelId: travel._id }))
    t.is(res.status, 200)
  }
})

const expenses: Expense[] = [
  //@ts-ignore
  {
    description: 'Konferenzkosten',
    cost: {
      amount: 82, //@ts-ignore
      currency: { _id: 'TRY' },
      receipts: [],
      date: new Date('2023-08-07T00:00:00.000Z')
    },
    purpose: 'professional'
  }
]

test.serial('POST /travel/expense', async (t) => {
  t.plan(expenses.length + 0)
  for (const expense of expenses) {
    const res = await agent.post('/api/travel/expense').send(Object.assign(expense, { travelId: travel._id }))
    t.is(res.status, 200)
  }
})

test.serial('POST /travel/underExamination', async (t) => {
  t.plan(4)
  const comment = "A quite long comment but this doesn't matter because mongoose has no limit."
  const res = await agent.post('/api/travel/underExamination').send({ _id: travel._id, comment })
  t.is(res.status, 200)
  t.is((res.body.result as Travel).state, 'underExamination')
  t.is((res.body.result as Travel).history.length, 2)
  t.like((res.body.result as Travel).comments[1], { text: comment, toState: 'underExamination' })
})

// EXAMINE

test.serial('POST /examine/travel/refunded', async (t) => {
  await loginExamine(agent)
  t.plan(4)
  const comment = '' // empty string should not create comment
  const res = await agent.post('/api/examine/travel/refunded').send({ _id: travel._id, comment })
  t.is(res.status, 200)
  t.is((res.body.result as Travel).state, 'refunded')
  t.is((res.body.result as Travel).history.length, 3)
  t.is((res.body.result as Travel).comments.length, 2)
})

// REPORT

test.serial('GET /travel/report', async (t) => {
  await loginUser(agent)
  const res = await agent.get('/api/travel/report').query({ id: travel._id })
  t.is(res.status, 200)
})

test.after.always('DELETE /travel', async (t) => {
  await loginUser(agent)
  const res = await agent.delete('/api/travel').query({ id: travel._id })
  t.is(res.status, 200)
})
