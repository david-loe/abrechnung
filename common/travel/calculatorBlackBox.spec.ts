import test from 'ava'
import { AddUpTravel, baseCurrency, Country, CountryCode, DocumentFile, TravelSettings } from '../types.js'
import { addUp } from '../utils/scripts.js'
import { TravelCalculator } from './calculator.js'
import travelSettings from './travelSettings.json' with { type: 'json' }

const DE: Country = {
  _id: 'DE',
  name: { de: 'Deutschland', en: 'Germany' },
  currency: 'EUR',

  lumpSums: [
    {
      validFrom: '2024-01-01',
      overnight: 18,
      catering8: 12,
      catering24: 24,
      specials: [{ city: 'Berlin', overnight: 22, catering8: 13, catering24: 26 }]
    },
    {
      validFrom: '2025-01-01',
      overnight: 20,
      catering8: 14,
      catering24: 28,
      specials: [{ city: 'Berlin', overnight: 25, catering8: 15, catering24: 30 }]
    }
  ]
}

const FR: Country = {
  _id: 'FR',
  name: { de: 'Frankreich', en: 'France' },
  currency: 'EUR',
  needsA1Certificate: true,

  lumpSums: [
    {
      validFrom: '2024-01-01',
      overnight: 55,
      catering8: 16,
      catering24: 32,
      specials: [{ city: 'Paris', overnight: 58, catering8: 16, catering24: 36 }]
    },
    {
      validFrom: '2025-01-01',
      overnight: 45,
      catering8: 17,
      catering24: 34,
      specials: [{ city: 'Paris', overnight: 60, catering8: 17, catering24: 40 }]
    }
  ]
}

const AT: Country = {
  _id: 'AT',
  name: { de: 'Österreich', en: 'Austria' },
  currency: 'EUR',

  lumpSums: [
    { validFrom: '2024-01-01', overnight: 32, catering8: 14, catering24: 28 },
    { validFrom: '2025-01-01', overnight: 35, catering8: 15, catering24: 30 }
  ]
}

const LU: Country = {
  _id: 'LU',
  name: { de: 'Luxemburg', en: 'Luxembourg' },
  currency: 'EUR',

  lumpSums: [
    { validFrom: '2024-01-01', overnight: 36, catering8: 14, catering24: 28 },
    { validFrom: '2025-01-01', overnight: 38, catering8: 16, catering24: 32 }
  ]
}

const EUR = baseCurrency

const userSimple1 = { _id: 'u1', name: { familyName: '1', givenName: 'User' }, email: 'user1@email.com' }
// const userSimple2 = { _id: 'u2', name: { familyName: '2', givenName: 'User' }, email: 'user2@email.com' }
const projectSimple1 = { _id: 'p1', name: 'P1', identifier: '1', organisation: 'o1', balance: { amount: 0 } }
const projectSimple2 = { _id: 'p2', name: 'P2', identifier: '2', organisation: 'o1', balance: { amount: 0 } }

const receipt1: DocumentFile<string, Blob> = {
  _id: 'r1',
  owner: userSimple1._id,
  data: new Blob(),
  type: 'image/png',
  name: 'receipt1.png'
}

const travels = [
  {
    travel: {
      _id: 'T-A',
      isCrossBorder: true,
      a1Certificate: { exactAddress: '10 Rue de Rivoli, 75001 Paris', destinationName: 'Kunde Paris' },
      lastPlaceOfWork: { country: DE },
      reason: 'Kundentermin und Workshop',
      destinationPlace: { place: 'Paris', country: FR },
      startDate: '2025-03-10',
      endDate: '2025-03-13',
      project: projectSimple1,
      advances: [],
      stages: [
        {
          _id: 'TA-S1',
          departure: '2025-03-10T08:00:00Z',
          arrival: '2025-03-10T19:00:00Z',
          startLocation: { place: 'München', country: DE },
          endLocation: { place: 'Paris', country: FR, special: 'Paris' },
          midnightCountries: null,
          transport: { type: 'ownCar' as const, distance: 850, distanceRefundType: 'car' as const },
          cost: { currency: EUR, amount: 255.0, date: '2025-03-10', receipts: [receipt1] },
          purpose: 'professional' as const,
          note: 'Anreise mit eigenem PKW'
        },
        {
          _id: 'TA-S2',
          departure: '2025-03-11T09:00:00Z',
          arrival: '2025-03-11T17:00:00Z',
          startLocation: { place: 'Paris', country: FR, special: 'Paris' },
          endLocation: { place: 'Paris', country: FR, special: 'Paris' },
          midnightCountries: null,
          transport: { type: 'otherTransport' as const },
          cost: { currency: EUR, amount: 45.0, date: '2025-03-11', receipts: [receipt1] },
          purpose: 'professional' as const,
          note: 'Lokale Fahrten (Metro/Taxi)'
        },
        {
          _id: 'TA-S3',
          departure: '2025-03-12T18:00:00Z',
          arrival: '2025-03-13T09:00:00Z',
          startLocation: { place: 'Paris', country: FR, special: 'Paris' },
          endLocation: { place: 'München', country: DE },
          midnightCountries: null,
          transport: { type: 'ownCar' as const, distance: 850, distanceRefundType: 'halfCar' as const },
          cost: { currency: EUR, amount: 127.5, date: '2025-03-13', receipts: [receipt1] },
          purpose: 'professional' as const,
          note: 'Rückreise mit halbem PKW-Satz'
        }
      ],
      expenses: [
        {
          _id: 'TA-E1',
          description: 'Maut und Parken',
          purpose: 'professional' as const,
          cost: { currency: EUR, amount: 35.0, date: '2025-03-10', receipts: [receipt1] },
          project: projectSimple2
        },
        {
          _id: 'TA-E2',
          description: 'Abendessen privat',
          purpose: 'mixed' as const,
          cost: { currency: EUR, amount: 60.0, date: '2025-03-12', receipts: [receipt1] },
          note: 'Gemischte Veranlassung'
        }
      ],
      days: [
        {
          date: '2025-03-10',
          cateringRefund: { breakfast: true, lunch: true, dinner: true },
          purpose: 'professional' as const,
          overnightRefund: true
        },
        {
          date: '2025-03-11',
          cateringRefund: { breakfast: true, lunch: false, dinner: true },
          purpose: 'professional' as const,
          overnightRefund: true
        },
        {
          date: '2025-03-12',
          cateringRefund: { breakfast: false, lunch: true, dinner: true },
          purpose: 'professional' as const,
          overnightRefund: false
        },
        {
          date: '2025-03-13',
          cateringRefund: { breakfast: true, lunch: true, dinner: false },
          purpose: 'professional' as const,
          overnightRefund: false
        }
      ]
    },
    computed: {
      currency: EUR,
      sumStages: 427.5,
      sumExpenses: 95.0,
      sumLumpSumsCatering: 84.0,
      sumLumpSumsOvernight: 120.0,
      totalForTravel: 726.5
    },
    expectedResult: { expenses: 522.5, lumpSums: 195.8 },
    edgeCasesCovered: [
      'A1-Pflichtland mit a1Certificate',
      'Special-Stadt (Paris) überschreibt Land',
      'Eigenes Fahrzeug: car und halfCar',
      'Mahlzeitenabzüge angewendet',
      'Übernachtungspauschalen nicht innerhalb durchgehender Stage',
      'lastPlaceOfWork wirksam'
    ]
  },
  {
    travel: {
      _id: 'T-B',
      isCrossBorder: true,
      professionalShare: 1.0,
      reason: 'Konferenzreise mit Langstreckenflug',
      destinationPlace: { place: 'Langstreckenflug', country: DE },
      startDate: '2025-02-01',
      endDate: '2025-02-03',
      project: projectSimple1,
      advances: [],
      stages: [
        {
          _id: 'TB-S0',
          departure: '2025-02-01T07:30:00Z',
          arrival: '2025-02-01T08:30:00Z',
          startLocation: { place: 'Berlin', country: DE },
          endLocation: { place: 'BER Flughafen', country: DE },
          midnightCountries: null,
          transport: { type: 'ownCar' as const, distance: 25, distanceRefundType: 'motorcycle' as const },
          cost: { currency: EUR, amount: 5.0, date: '2025-02-01', receipts: [receipt1] },
          purpose: 'professional' as const
        },
        {
          _id: 'TB-S1',
          departure: '2025-02-01T09:00:00Z',
          arrival: '2025-02-03T12:00:00Z',
          startLocation: { place: 'BER Flughafen', country: DE },
          endLocation: { place: 'Ankunft International', country: DE },
          midnightCountries: null,
          transport: { type: 'airplane' as const },
          cost: { currency: EUR, amount: 1200.0, date: '2025-02-01', receipts: [receipt1] },
          purpose: 'professional' as const,
          note: 'Flug >24h, zweite Mitternacht auf Flug-Pauschalland AT'
        },
        {
          _id: 'TB-S2',
          departure: '2025-02-03T12:30:00Z',
          arrival: '2025-02-03T13:30:00Z',
          startLocation: { place: 'Heimreise Taxi', country: DE },
          endLocation: { place: 'Berlin', country: DE },
          midnightCountries: null,
          transport: { type: 'otherTransport' as const },
          cost: { currency: EUR, amount: 40.0, date: '2025-02-03', receipts: [receipt1] },
          purpose: 'professional' as const
        }
      ],
      expenses: [
        {
          _id: 'TB-E1',
          description: 'Aufgabegepäck',
          purpose: 'professional' as const,
          cost: { currency: EUR, amount: 30.0, date: '2025-02-01', receipts: [receipt1] }
        }
      ],
      days: [
        {
          date: '2025-02-01',
          cateringRefund: { breakfast: true, lunch: true, dinner: true },
          purpose: 'professional' as const,
          overnightRefund: false
        },
        {
          date: '2025-02-02',
          cateringRefund: { breakfast: true, lunch: false, dinner: true },
          purpose: 'professional' as const,
          overnightRefund: false
        },
        {
          date: '2025-02-03',
          cateringRefund: { breakfast: true, lunch: true, dinner: false },
          purpose: 'professional' as const,
          overnightRefund: false
        }
      ]
    },
    expectedResult: { expenses: 1275, lumpSums: 33.6 },
    edgeCasesCovered: [
      'Flug >24h mit zweiter Mitternacht (AT als Flug-Pauschalland)',
      'Motorrad-Satz angewendet',
      'Mahlzeitenabzug am vollen Tag',
      'Keine Übernachtungspauschale bei durchgehender Flug-Stage'
    ]
  },
  {
    travel: {
      _id: 'T-C',
      isCrossBorder: true,
      professionalShare: 0.8,
      reason: 'Langfahrt Bahn mit Länderwechseln',
      destinationPlace: { place: 'Paris', country: FR },
      startDate: '2025-05-10',
      endDate: '2025-05-12',
      project: projectSimple1,
      advances: [],
      stages: [
        {
          _id: 'TC-S0',
          departure: '2025-05-10T05:15:00Z',
          arrival: '2025-05-10T05:45:00Z',
          startLocation: { place: 'Hamburg', country: DE },
          endLocation: { place: 'Hbf Hamburg', country: DE },
          midnightCountries: null,
          transport: { type: 'ownCar' as const, distance: 10, distanceRefundType: 'halfCar' as const },
          cost: { currency: EUR, amount: 1.5, date: '2025-05-10', receipts: [receipt1] },
          purpose: 'professional' as const
        },
        {
          _id: 'TC-S1',
          departure: '2025-05-10T06:00:00Z',
          arrival: '2025-05-12T09:00:00Z',
          startLocation: { place: 'Hamburg Hbf', country: DE },
          endLocation: { place: 'Paris Est', country: FR },
          midnightCountries: [
            { date: '2025-05-11', country: AT },
            { date: '2025-05-12', country: FR }
          ],
          transport: { type: 'otherTransport' as const },
          cost: { currency: EUR, amount: 180.0, date: '2025-05-10', receipts: [receipt1] },
          purpose: 'professional' as const,
          note: 'Bahnfahrt >1 Mitternacht, Reihenfolge der Mitternachtsländer maßgeblich'
        }
      ],
      expenses: [
        {
          _id: 'TC-E1',
          description: 'Sitzplatzreservierung',
          purpose: 'professional' as const,
          cost: { currency: EUR, amount: 12.0, date: '2025-05-10', receipts: [receipt1] }
        }
      ],
      days: [
        {
          date: '2025-05-10',
          cateringRefund: { breakfast: true, lunch: true, dinner: true },
          purpose: 'professional' as const,
          overnightRefund: false
        },
        {
          date: '2025-05-11',
          cateringRefund: { breakfast: true, lunch: true, dinner: true },
          purpose: 'professional' as const,
          overnightRefund: false
        },
        {
          date: '2025-05-12',
          cateringRefund: { breakfast: true, lunch: true, dinner: false },
          purpose: 'professional' as const,
          overnightRefund: false
        }
      ]
    },
    expectedResult: { expenses: 193.5, lumpSums: 45.4 },
    edgeCasesCovered: [
      'Land-Stage mit >1 Mitternacht, Reihenfolge verwendet',
      'HalfCar-Satz angewendet',
      'Keine Übernachtungspauschale bei durchgehender Land-Stage'
    ]
  }
]

const countries: Record<CountryCode, Country> = { DE, FR, AT, LU }
const getCountryById = async (id: CountryCode) => countries[id]

const calculator = new TravelCalculator(getCountryById, Object.assign(travelSettings, { _id: 'settings' }) as TravelSettings)

for (const { travel, expectedResult } of travels) {
  test(`Travel ${travel._id} calculation`, async (t) => {
    await calculator.calc(travel)
    const result = addUp<string, AddUpTravel>(travel as unknown as AddUpTravel)
    let resLumpSum = 0
    let resExpenses = 0
    for (const addUpRes of result) {
      resLumpSum += addUpRes.lumpSums.amount
      resExpenses += addUpRes.expenses.amount
    }
    t.is(resLumpSum, expectedResult.lumpSums)
    t.is(resExpenses, expectedResult.expenses)
  })
}
