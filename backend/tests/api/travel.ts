import test from 'ava'
import agent from './_agent.js'
import { TravelSimple } from '../../../common/types.js'

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
    amount: null,
    currency: 'EUR',
    exchangeRate: null
  }
}

test.beforeEach('POST /travel/appliedFor', async (t) => {
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
    }
  }
})
