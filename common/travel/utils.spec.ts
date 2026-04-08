import test from 'ava'
import { baseCurrency, Country, Stage } from '../types.js'
import { getStagesInBounds, getStagesOutOfBounds } from './utils.js'

const countryDE: Country = {
  _id: 'DE',
  name: { de: 'Deutschland', en: 'Germany', fr: 'Allemagne', es: 'Alemania', ru: 'Германия', kk: 'Германия' },
  lumpSums: []
}

function createStage(_id: string, departure: string, arrival: string): Stage<string> {
  return {
    _id,
    departure: new Date(departure),
    arrival: new Date(arrival),
    startLocation: { place: 'Berlin', country: countryDE },
    endLocation: { place: 'Berlin', country: countryDE },
    transport: { type: 'otherTransport' },
    cost: { amount: 0, currency: baseCurrency, date: new Date('2024-01-01T00:00:00Z'), receipts: [] },
    purpose: 'professional'
  }
}

test('getStagesOutOfBounds uses the provided tolerance', (t) => {
  const stages: Stage<string>[] = [
    createStage('before-tolerance', '2024-01-06T10:00:00Z', '2024-01-06T12:00:00Z'),
    createStage('trim-start', '2024-01-06T23:00:00Z', '2024-01-07T12:00:00Z'),
    createStage('inside', '2024-01-10T08:00:00Z', '2024-01-11T18:00:00Z'),
    createStage('trim-end', '2024-01-14T20:00:00Z', '2024-01-15T02:00:00Z'),
    createStage('after-tolerance', '2024-01-15T08:00:00Z', '2024-01-15T10:00:00Z')
  ]

  const result = getStagesOutOfBounds(stages, new Date('2024-01-10'), new Date('2024-01-11'), 3)

  t.deepEqual(
    result.map((stage) => stage._id),
    ['before-tolerance', 'trim-start', 'trim-end', 'after-tolerance']
  )
})

test('getStagesInBounds keeps only stages fully inside the provided tolerance bounds without mutating input', (t) => {
  const stages: Stage<string>[] = [
    createStage('before-tolerance', '2024-01-06T10:00:00Z', '2024-01-06T12:00:00Z'),
    createStage('trim-start', '2024-01-06T23:00:00Z', '2024-01-07T12:00:00Z'),
    createStage('inside', '2024-01-10T08:00:00Z', '2024-01-11T18:00:00Z'),
    createStage('trim-end', '2024-01-14T20:00:00Z', '2024-01-15T02:00:00Z'),
    createStage('after-tolerance', '2024-01-15T08:00:00Z', '2024-01-15T10:00:00Z')
  ]

  const originalDeparture = new Date(stages[1].departure)
  const originalArrival = new Date(stages[3].arrival)

  const result = getStagesInBounds(stages, new Date('2024-01-10'), new Date('2024-01-11'), 3)

  t.deepEqual(
    result.map((stage) => stage._id),
    ['inside']
  )
  t.is(new Date(result[0].departure).toISOString(), '2024-01-10T08:00:00.000Z')
  t.is(new Date(result[0].arrival).toISOString(), '2024-01-11T18:00:00.000Z')
  t.is(new Date(stages[1].departure).toISOString(), originalDeparture.toISOString())
  t.is(new Date(stages[3].arrival).toISOString(), originalArrival.toISOString())
})

test('stage bounds utilities support zero tolerance', (t) => {
  const stages: Stage<string>[] = [
    createStage('before', '2024-01-09T10:00:00Z', '2024-01-09T12:00:00Z'),
    createStage('trim-start', '2024-01-09T23:00:00Z', '2024-01-10T12:00:00Z'),
    createStage('inside', '2024-01-10T08:00:00Z', '2024-01-11T18:00:00Z'),
    createStage('trim-end', '2024-01-11T20:00:00Z', '2024-01-12T02:00:00Z'),
    createStage('after', '2024-01-12T08:00:00Z', '2024-01-12T10:00:00Z')
  ]

  t.deepEqual(
    getStagesOutOfBounds(stages, new Date('2024-01-10'), new Date('2024-01-11'), 0).map((stage) => stage._id),
    ['before', 'trim-start', 'trim-end', 'after']
  )
  t.deepEqual(
    getStagesInBounds(stages, new Date('2024-01-10'), new Date('2024-01-11'), 0).map((stage) => stage._id),
    ['inside']
  )
})
