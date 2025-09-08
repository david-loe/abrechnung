import test from 'ava'
import { baseCurrency, Country, CountryCode, Stage, Travel, TravelDay, TravelSettings, TravelState } from '../types.js'
import { TravelCalculator } from './calculator.js'
import travelSettings from './travelSettings.json' with { type: 'json' }

function createSetup() {
  const countryDE: Country = {
    _id: 'DE',
    name: { de: 'Deutschland', en: 'Germany' },
    lumpSums: [{ validFrom: new Date('2020-01-01'), catering8: 10, catering24: 20, overnight: 30 }]
  }

  const countryFR: Country = {
    _id: 'FR',
    name: { de: 'Frankreich', en: 'France' },
    lumpSums: [{ validFrom: new Date('2020-01-01'), catering8: 12, catering24: 24, overnight: 40 }]
  }

  const countries: Record<CountryCode, Country> = { DE: countryDE, FR: countryFR }
  const getCountryById = async (id: CountryCode) => countries[id]

  const tc = new TravelCalculator(getCountryById, Object.assign(travelSettings, { _id: 'settings' }) as TravelSettings)

  const stages: Stage<string>[] = [
    {
      departure: new Date('2023-01-01T08:00:00Z'),
      arrival: new Date('2023-01-01T18:00:00Z'),
      startLocation: { place: 'Berlin', country: countryDE },
      endLocation: { place: 'Paris', country: countryFR },
      transport: { type: 'ownCar', distance: 100, distanceRefundType: 'car' },
      cost: { amount: 0, currency: baseCurrency, date: new Date('2023-01-01'), receipts: [] },
      purpose: 'professional',
      _id: 's1'
    },
    {
      departure: new Date('2023-01-02T08:00:00Z'),
      arrival: new Date('2023-01-02T18:00:00Z'),
      startLocation: { place: 'Paris', country: countryFR },
      endLocation: { place: 'Berlin', country: countryDE },
      transport: { type: 'ownCar', distance: 200, distanceRefundType: 'car' },
      cost: { amount: 0, currency: baseCurrency, date: new Date('2023-01-02'), receipts: [] },
      purpose: 'professional',
      _id: 's2'
    }
  ]

  const days: TravelDay<string>[] = [
    {
      date: new Date('2023-01-01'),
      country: countryDE,
      cateringRefund: { breakfast: true, lunch: true, dinner: true },
      overnightRefund: true,
      purpose: 'professional',
      lumpSums: { overnight: { refund: { amount: 0 } }, catering: { refund: { amount: 0 }, type: 'catering8' } },
      _id: 'd1'
    },
    {
      date: new Date('2023-01-02'),
      country: countryDE,
      cateringRefund: { breakfast: true, lunch: true, dinner: true },
      overnightRefund: false,
      purpose: 'private',
      lumpSums: { overnight: { refund: { amount: 0 } }, catering: { refund: { amount: 0 }, type: 'catering8' } },
      _id: 'd2'
    }
  ]

  const travel: Travel<string> = {
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-02'),
    destinationPlace: { place: 'Paris', country: countryFR },
    stages,
    expenses: [],
    days,
    progress: 0,
    professionalShare: null,
    lastPlaceOfWork: null,
    name: 'Trip',
    owner: { _id: 'u1', name: { familyName: '1', givenName: 'User' }, email: 'user1@email.com' },
    editor: { _id: 'u1', name: { familyName: '1', givenName: 'User' }, email: 'user1@email.com' },
    project: { _id: 'p1', name: 'P', identifier: '1', organisation: 'o1', balance: { amount: 0 } },
    comments: [],
    state: TravelState.APPROVED,
    log: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    addUp: [],
    advances: [],
    reason: 'Reason',
    history: [],
    historic: false,
    _id: 't1'
  }

  return { tc, stages, days, travel }
}

test('getProgress returns 100 when stages cover approved period', (t) => {
  const { tc, travel } = createSetup()
  const progress = tc.getProgress(travel)
  t.is(progress, 100)
})

test('getBorderCrossings detects all crossings', (t) => {
  const { tc, stages } = createSetup()
  const b = tc.getBorderCrossings(stages)
  t.deepEqual(
    b.map((x) => x.country._id),
    ['DE', 'FR', 'DE']
  )
})

test('getDays creates entries for each day and keeps flags', (t) => {
  const { tc, stages, days } = createSetup()
  const res = tc.getDays(stages, days)
  t.is(res.length, 2)
  t.false(res[1].overnightRefund)
  t.is(res[1].purpose, 'private')
})

test('calculateDays assigns countries per day', async (t) => {
  const { tc, stages, travel } = createSetup()
  const res = await tc.calculateDays(stages, travel.lastPlaceOfWork, travel.destinationPlace, travel.days)
  t.deepEqual(
    res.map((d) => d.country._id),
    ['FR', 'FR']
  )
})

test('calc computes refunds and costs', async (t) => {
  const { tc, travel, stages } = createSetup()
  const conflicts = await tc.calc(travel)
  t.is(conflicts.length, 0)
  t.is(stages[0].cost.amount, 30)
  t.is(stages[1].cost.amount, 60)
  t.is(travel.days[0].lumpSums.catering.refund.amount, 12)
  t.is(travel.days[1].lumpSums.catering.refund.amount, 0)
  t.is(travel.days[0].lumpSums.overnight.refund.amount, 40)
  t.is(travel.progress, 100)
})

test('calc reports conflicts for overlapping stages', async (t) => {
  const { tc, stages, travel } = createSetup()
  const badStages: Stage<string>[] = [
    stages[0],
    { ...stages[0], _id: 's3', departure: new Date('2023-01-01T10:00:00Z'), arrival: new Date('2023-01-01T19:00:00Z') }
  ]
  const badTravel = { ...travel, stages: badStages }
  const conflicts = await tc.calc(badTravel)
  t.true(conflicts.length > 0)
})
