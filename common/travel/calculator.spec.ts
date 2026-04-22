import test from 'ava'
import { baseCurrency, Country, CountryCode, DocumentFile, Stage, TravelState } from '../types.js'
import { TravelCalculator } from './calculator.js'
import travelSettings from './travelSettings.js'
import { combineTravelValidationResults } from './validator.js'

function createSetup() {
  const countryDE: Country = {
    _id: 'DE',
    name: { de: 'Deutschland', en: '', fr: '', es: '', ru: '', kk: '' },
    lumpSums: [
      { validFrom: new Date('2020-01-01'), validUntil: null, catering8: 10, catering24: 20, overnight: 30 },
      { validFrom: new Date('2019-01-01'), validUntil: new Date('2019-12-31'), catering8: 99, catering24: 99, overnight: 99 }
    ]
  }

  const countryFR: Country = {
    _id: 'FR',
    name: { de: 'Frankreich', en: '', fr: '', es: '', ru: '', kk: '' },
    lumpSums: [
      { validFrom: new Date('2020-01-01'), validUntil: new Date('2999-12-31'), catering8: 12, catering24: 24, overnight: 40 },
      { validFrom: new Date('3000-01-01'), validUntil: null, catering8: 99, catering24: 99, overnight: 99 }
    ]
  }

  const countries: Record<CountryCode, Country> = { DE: countryDE, FR: countryFR }
  const getCountryById = async (id: CountryCode) => countries[id]

  const tc = new TravelCalculator(getCountryById, { ...travelSettings, _id: 'settings' })

  const stages: Stage<string>[] = [
    {
      departure: new Date('2023-01-01T08:00:00Z'),
      arrival: new Date('2023-01-01T18:00:00Z'),
      startLocation: { place: 'Berlin', country: countryDE },
      endLocation: { place: 'Paris', country: countryFR },
      transport: { type: 'ownCar' as const, distance: 100, distanceRefundType: 'car' as const },
      cost: { amount: 0, currency: baseCurrency, date: new Date('2023-01-01'), receipts: [] },
      purpose: 'professional' as const,
      _id: 's1'
    },
    {
      departure: new Date('2023-01-02T08:00:00Z'),
      arrival: new Date('2023-01-02T18:00:00Z'),
      startLocation: { place: 'Paris', country: countryFR },
      endLocation: { place: 'Berlin', country: countryDE },
      transport: { type: 'ownCar' as const, distance: 200, distanceRefundType: 'car' as const },
      cost: { amount: 0, currency: baseCurrency, date: new Date('2023-01-02'), receipts: [] },
      purpose: 'professional' as const,
      _id: 's2'
    }
  ]

  const days = [
    {
      date: new Date('2023-01-01'),
      cateringRefund: { breakfast: true, lunch: true, dinner: false },
      overnightRefund: true,
      purpose: 'professional' as const,
      _id: 'd1'
    },
    {
      date: new Date('2023-01-02'),
      cateringRefund: { breakfast: true, lunch: true, dinner: true },
      overnightRefund: false,
      purpose: 'private' as const,
      _id: 'd2'
    }
  ]

  const travel = {
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
    _id: 't1',
    reference: 1
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
  const { tc, travel } = createSetup()
  const { result, conflicts } = await tc.calc(travel)
  t.is(conflicts.length, 0)
  t.is(result?.stages[0].cost.amount, 30)
  t.is(result?.stages[1].cost.amount, 60)
  t.is(result?.days[0].lumpSums.catering.refund.amount, 2.4)
  t.is(result?.days[1].lumpSums.catering.refund.amount, 0)
  t.is(result?.days[0].lumpSums.overnight.refund.amount, 40)
  t.is(result?.progress, 100)
})

test('calc rounds overnight refunds with decimal multiplication', async (t) => {
  const { tc, travel } = createSetup()
  tc.travelSettings.factorOvernightLumpSum = 0.5
  travel.destinationPlace.country.lumpSums[0].overnight = 2.01

  const { result, conflicts } = await tc.calc(travel)

  t.is(conflicts.length, 0)
  t.is(result?.days[0].lumpSums.overnight.refund.amount, 1.01)
})

test('calc rounds catering refunds after decimal subtraction before factor application', async (t) => {
  const { tc, travel } = createSetup()
  tc.travelSettings.factorCateringLumpSum = 0.5
  travel.days[0].cateringRefund = { breakfast: false, lunch: true, dinner: true }
  travel.destinationPlace.country.lumpSums[0].catering8 = 2.01
  travel.destinationPlace.country.lumpSums[0].catering24 = 5

  const { result, conflicts } = await tc.calc(travel)

  t.is(conflicts.length, 0)
  t.is(result?.days[0].lumpSums.catering.refund.amount, 0.51)
})

test('calc reports conflicts for overlapping stages', async (t) => {
  const { tc, stages, travel } = createSetup()
  const badStages: Stage<string>[] = [
    stages[0],
    { ...stages[0], _id: 's3', departure: new Date('2023-01-01T10:00:00Z'), arrival: new Date('2023-01-01T19:00:00Z') }
  ]
  const badTravel = { ...travel, stages: badStages }
  const { result, conflicts } = await tc.calc(badTravel)
  t.true(conflicts.length > 0)
  t.truthy(result)
  t.true((result?.progress ?? 0) > 0)
  t.is(result?.days[0].lumpSums.catering.refund.amount, 0)
  t.is(result?.days[0].lumpSums.overnight.refund.amount, 0)
})

test('validator returns warnings independently from validation errors', (t) => {
  const { tc, travel } = createSetup()
  const results = tc.validator.getValidationResults({ ...travel, endDate: new Date('2022-12-20') })
  t.true(results.some((result) => result.code === 'stageOutOfBounds' && result.severity === 'warning'))
})

test('validator requires receipts for non-own-car travel stages with a cost amount', (t) => {
  const { tc, stages, travel } = createSetup()
  const results = tc.validator.getValidationResults({
    ...travel,
    stages: [{ ...stages[0], transport: { type: 'airplane' }, cost: { ...stages[0].cost, amount: 10, receipts: [] } }, stages[1]]
  })

  t.true(
    results.some(
      (result) =>
        result.code === 'requiredForReview' &&
        result.path === 'stages.0.cost.receipts' &&
        result.reference?.collection === 'stages' &&
        result.reference.index[0] === 0
    )
  )
})

test('validator requires own car proof when vehicle registration is required and missing', (t) => {
  const { tc, stages, travel } = createSetup()
  tc.updateSettings({ ...travelSettings, _id: 'settings', vehicleRegistrationWhenUsingOwnCar: 'required' })

  const results = tc.validator.getValidationResults({
    ...travel,
    stages: [{ ...stages[0], cost: { ...stages[0].cost, amount: 10, receipts: [] } }, stages[1]]
  })

  t.true(results.some((result) => result.code === 'requiredForReview' && result.path === 'stages.0.cost.receipts'))
})

test('validator accepts vehicle registration context for own car when required', (t) => {
  const { tc, stages, travel } = createSetup()
  tc.updateSettings({ ...travelSettings, _id: 'settings', vehicleRegistrationWhenUsingOwnCar: 'required' })
  const vehicleRegistration: DocumentFile<string>[] = [
    { _id: 'vr1', owner: 'u1', name: 'registration.pdf', type: 'application/pdf', data: new Blob([]) }
  ]

  const results = tc.validator.getValidationResults(
    { ...travel, stages: [{ ...stages[0], cost: { ...stages[0].cost, amount: 10, receipts: [] } }, stages[1]] },
    { vehicleRegistration }
  )

  t.false(results.some((result) => result.code === 'requiredForReview' && result.path === 'stages.0.cost.receipts'))
})

test('validator does not require own car receipts when vehicle registration is optional', (t) => {
  const { tc, stages, travel } = createSetup()
  tc.updateSettings({ ...travelSettings, _id: 'settings', vehicleRegistrationWhenUsingOwnCar: 'optional' })

  const results = tc.validator.getValidationResults({
    ...travel,
    stages: [{ ...stages[0], cost: { ...stages[0].cost, amount: 10, receipts: [] } }, stages[1]]
  })

  t.false(results.some((result) => result.code === 'requiredForReview' && result.path === 'stages.0.cost.receipts'))
})

test('validator does not require own car receipts when vehicle registration is disabled', (t) => {
  const { tc, stages, travel } = createSetup()
  tc.updateSettings({ ...travelSettings, _id: 'settings', vehicleRegistrationWhenUsingOwnCar: 'none' })

  const results = tc.validator.getValidationResults({
    ...travel,
    stages: [{ ...stages[0], cost: { ...stages[0].cost, amount: 10, receipts: [] } }, stages[1]]
  })

  t.false(results.some((result) => result.code === 'requiredForReview' && result.path === 'stages.0.cost.receipts'))
})

test('combineTravelValidationResults combines overlapping stage paths into one conflict', (t) => {
  const { tc, stages, travel } = createSetup()
  const results = tc.validator.getValidationResults({
    ...travel,
    stages: [stages[0], { ...stages[0], _id: 's3', departure: new Date('2023-01-01T10:00:00Z'), arrival: new Date('2023-01-01T19:00:00Z') }]
  })

  const combined = combineTravelValidationResults(results)
  const overlapConflicts = combined.filter((conflict) => conflict.code === 'stagesOverlapping')

  t.is(overlapConflicts.length, 1)
  t.deepEqual(overlapConflicts[0].reference?.index, [0, 1])
})

test('combineTravelValidationResults keeps distinct overlap pairs when one stage overlaps multiple others', (t) => {
  const { tc, stages, travel } = createSetup()
  const results = tc.validator.getValidationResults({
    ...travel,
    stages: [
      { ...stages[0], arrival: new Date('2023-01-01T20:00:00Z') },
      { ...stages[0], _id: 's3', departure: new Date('2023-01-01T09:00:00Z'), arrival: new Date('2023-01-01T11:00:00Z') },
      { ...stages[0], _id: 's4', departure: new Date('2023-01-01T12:00:00Z'), arrival: new Date('2023-01-01T14:00:00Z') }
    ]
  })

  const combined = combineTravelValidationResults(results)
  const overlapConflicts = combined.filter((conflict) => conflict.code === 'stagesOverlapping')

  t.is(overlapConflicts.length, 2)
  t.deepEqual(
    overlapConflicts.map((conflict) => conflict.reference?.index),
    [
      [0, 1],
      [0, 2]
    ]
  )
})

test('combineTravelValidationResults does not collapse multi-overlap markers into same-stage conflicts', (t) => {
  const { tc, stages, travel } = createSetup()
  const results = tc.validator.getValidationResults({
    ...travel,
    stages: [
      { ...stages[0], arrival: new Date('2023-01-01T18:00:00Z') },
      { ...stages[0], _id: 's3', departure: new Date('2023-01-01T09:00:00Z'), arrival: new Date('2023-01-01T17:00:00Z') },
      { ...stages[0], _id: 's4', departure: new Date('2023-01-01T10:00:00Z'), arrival: new Date('2023-01-01T16:00:00Z') }
    ]
  })

  const combined = combineTravelValidationResults(results)
  const overlapConflicts = combined.filter((conflict) => conflict.code === 'stagesOverlapping')

  t.is(overlapConflicts.length, 3)
  t.true(overlapConflicts.every((conflict) => (conflict.reference?.index.length || 0) === 2))
  t.deepEqual(
    overlapConflicts.map((conflict) => conflict.reference?.index),
    [
      [0, 1],
      [0, 2],
      [1, 2]
    ]
  )
})

test('combineTravelValidationResults combines country-change paths into one conflict', (t) => {
  const { tc, stages, travel } = createSetup()
  const results = tc.validator.getValidationResults({
    ...travel,
    stages: [stages[0], { ...stages[1], startLocation: { place: 'Berlin', country: stages[0].startLocation.country } }]
  })

  const combined = combineTravelValidationResults(results)
  const countryChangeConflicts = combined.filter((result) => result.code === 'countryChangeBetweenStages')

  t.is(countryChangeConflicts.length, 1)
  t.deepEqual(countryChangeConflicts[0].reference?.index, [0, 1])
})
