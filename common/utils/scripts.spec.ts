import test from 'ava'
import {
  type AddUpReport,
  type AddUpTravel,
  type AdvanceBase,
  AdvanceState,
  baseCurrency,
  type Cost,
  type CountrySimple,
  type FlatAddUp,
  type Place,
  type Project,
  type TravelDay
} from '../types.js'
import {
  addUp,
  convertGermanDateToHTMLDate,
  csvToObjects,
  datetimeToDateString,
  datetimeToDatetimeString,
  detectSeparator,
  escapeRegExp,
  getById,
  getFlagEmoji,
  hexToRGB,
  htmlInputStringToDateTime,
  isValidDate,
  mailToLink,
  msTeamsToLink,
  multiplyAmountAndRound,
  objectsToCSV,
  placeToString,
  roundAmount
} from './scripts.js'

type Id = string

const DE: CountrySimple = { _id: 'DE', name: { de: 'Deutschland', en: 'Germany', fr: '', es: '', ru: '', kk: '' }, flag: '🇩🇪' }

const place: Place = { place: 'Berlin', country: DE }

test('placeToString formats place', (t) => {
  t.is(placeToString(place), 'Berlin, DE 🇩🇪')
  t.is(placeToString(place, 'en'), 'Berlin, Germany 🇩🇪')
})

test('getById finds items or null', (t) => {
  const arr = [{ _id: '1' }, { _id: '2' }]
  t.deepEqual(getById('2', arr), { _id: '2' })
  t.is(getById('3', arr), null)
})

test('mailToLink and msTeamsToLink build urls', (t) => {
  const mail = mailToLink(['a@example.com', 'b@example.com'], 'Hello World', 'Body')
  t.is(mail, 'mailto:a@example.com;b@example.com?subject=Hello%20World&body=Body')
  const teams = msTeamsToLink(['user1'], 'Hello World', 'Topic')
  t.is(teams, 'https://teams.microsoft.com/l/chat/0/0?users=user1&topicName=Topic&message=Hello%20World')
})

test('getFlagEmoji returns emoji or null', (t) => {
  t.is(getFlagEmoji('DE'), '🇩🇪')
  t.is(getFlagEmoji('EUR'), '🇪🇺')
  t.is(getFlagEmoji('XAF'), null)
})

test('date helpers', (t) => {
  t.truthy(isValidDate('2023-01-02'))
  t.is(isValidDate('bad'), null)
  t.is(datetimeToDateString('2023-01-02T10:05:00Z'), '2023-01-02')
  t.is(datetimeToDatetimeString('2023-01-02T10:05:00Z'), '2023-01-02T10:05')
  t.is(htmlInputStringToDateTime('2023-01-02T10:05')?.toISOString(), '2023-01-02T10:05:00.000Z')
})

test('detectSeparator', (t) => {
  t.is(detectSeparator('a;b;c\n1;2;3'), ';')
  t.is(detectSeparator('a,b,c\n1,2,3'), ',')
})

test('convertGermanDateToHTMLDate', (t) => {
  t.is(convertGermanDateToHTMLDate('1.2.2023'), '2023-02-01')
  t.is(convertGermanDateToHTMLDate('2023-02-01'), '2023-02-01')
})

test('csvToObjects ignores empty headers', (t) => {
  const csv = 'cost.date;description;cost.amount;cost.currency;note;;;;\n01.01.2023;#001;400000;UGX;My Note;;1;;\n'

  t.deepEqual(csvToObjects(csv, {}, ';'), [
    { cost: { date: '01.01.2023', amount: '400000', currency: 'UGX' }, description: '#001', note: 'My Note' }
  ])
})

test('csvToObjects ignores empty rows', (t) => {
  const csv = ['cost.date;description;cost.amount', '2024-01-01;Test 1;12', ';;', '2024-01-02;Test 2;13', ''].join('\n')

  t.deepEqual(csvToObjects(csv, {}, ';'), [
    { cost: { date: '2024-01-01', amount: '12' }, description: 'Test 1' },
    { cost: { date: '2024-01-02', amount: '13' }, description: 'Test 2' }
  ])
})

test('csvToObjects covers nested paths, transformers, arrays and empty values', (t) => {
  const csv = [
    'meta/date;meta/title;stats/count;tags;flags;notes;  ;list/numbers;plainArray;list/empty;transform/empty',
    '"2023-02-01";"Hello;World";7;[alpha | beta];[];;ignored;[1 | 2 | 3];[x | y];[];',
    '2023-02-02;Second;;[];[active];note 2;;[4];[z];[left | right];value'
  ].join('\n')

  const result = csvToObjects(
    csv,
    {
      'meta/date': (val) => (val ? `date:${val}` : val),
      'stats/count': (val) => (val ? Number.parseInt(val, 10) : null),
      tags: (val) => val?.toUpperCase(),
      flags: (val) => val?.toUpperCase(),
      'list/numbers': (val) => (val ? Number.parseInt(val, 10) : null),
      plainArray: (val) => val?.toUpperCase(),
      'transform/empty': (val) => val ?? 'EMPTY'
    },
    ';',
    ' | ',
    '/'
  )

  t.deepEqual(result, [
    {
      meta: { date: 'date:2023-02-01', title: 'Hello;World' },
      stats: { count: 7 },
      tags: ['ALPHA', 'BETA'],
      flags: [''],
      notes: undefined,
      list: { numbers: [1, 2, 3], empty: '[]' },
      plainArray: ['X', 'Y'],
      transform: { empty: 'EMPTY' }
    },
    {
      meta: { date: 'date:2023-02-02', title: 'Second' },
      stats: { count: null },
      tags: [''],
      flags: ['ACTIVE'],
      notes: 'note 2',
      list: { numbers: [4], empty: '[left | right]' },
      plainArray: ['Z'],
      transform: { empty: 'value' }
    }
  ])
})

test('objectsToCSV converts arrays', (t) => {
  const csv = objectsToCSV([
    { a: 1, b: [1, 2] },
    { a: 2, b: [3] }
  ])
  t.is(csv, 'a\tb\n1\t[1, 2]\n2\t[3]\n')
})

test('escapeRegExp', (t) => {
  t.is(escapeRegExp('a.b?c'), 'a\\.b\\?c')
  t.is(escapeRegExp('test.email@domain.com'), 'test\\.email@domain\\.com')
})

test('hexToRGB', (t) => {
  t.deepEqual(hexToRGB('#ffaa00'), [255, 170, 0])
  t.deepEqual(hexToRGB('#0f0'), [0, 255, 0])
  t.throws(() => hexToRGB('#abcd'))
})

test('roundAmount rounds to cents and normalizes negative zero', (t) => {
  t.is(roundAmount(-0.0001), 0)
  t.is(roundAmount(-0.005), -0.01)
  t.is(roundAmount(1.005), 1.01)
  t.is(roundAmount(1.0049999999999997), 1)
  t.is(roundAmount(-1.0049999999999997), -1)
})

test('multiplyAmountAndRound multiplies in decimal space before cent rounding', (t) => {
  t.is(multiplyAmountAndRound(2.01, 0.5), 1.01)
  t.is(multiplyAmountAndRound(1, 1.0049999999999997), 1)
})

const resolveProjectId = (entry: FlatAddUp<Id>['project']) => (typeof entry === 'string' ? entry : entry._id)

const createProject = (id: string): Project<Id> => ({
  _id: id,
  identifier: `PRJ-${id}`,
  organisation: `ORG-${id}`,
  name: `Project ${id}`,
  balance: { amount: 0 }
})

const createCost = (amount: number): Cost<Id> => ({
  amount,
  currency: baseCurrency,
  exchangeRate: null,
  receipts: [],
  date: new Date('2024-01-01').toISOString()
})

const createAdvance = (id: string, project: Project<Id>, amount: number): AdvanceBase<Id> => ({
  _id: id,
  name: `Advance ${id}`,
  project,
  budget: { amount, currency: baseCurrency },
  balance: { amount },
  reason: 'test',
  state: AdvanceState.APPROVED
})

const createTravelDay = (
  id: string,
  overnight: number,
  catering: number,
  purpose: TravelDay['purpose'] = 'professional'
): TravelDay<Id> => ({
  _id: id,
  date: new Date('2024-01-01').toISOString(),
  country: DE,
  purpose: purpose,
  cateringRefund: { breakfast: false, lunch: false, dinner: false },
  overnightRefund: true,
  lumpSums: { overnight: { refund: { amount: overnight } }, catering: { type: 'catering24', refund: { amount: catering } } },
  special: undefined
})

test('addUp aggregates expenses and advances per project for expense reports', (t) => {
  const projectA = createProject('A')
  const projectB = createProject('B')

  const expenseReport: AddUpReport = {
    project: projectA,
    expenses: [
      { _id: 'e1', description: 'Base project expense', cost: createCost(50), note: null, project: null },
      { _id: 'e2', description: 'Other project expense', cost: createCost(30), note: null, project: projectB },
      { _id: 'e3', description: 'Refund', cost: createCost(-100), note: null, project: projectB }
    ],
    advances: [createAdvance('adv-base', projectA, 40), createAdvance('adv-b', projectB, 25)]
  }

  const result = addUp<Id, AddUpReport>(expenseReport)

  t.is(result.length, 2)

  const baseProjectAddUp = result.find((entry) => resolveProjectId(entry.project) === projectA._id)
  t.truthy(baseProjectAddUp)
  if (!baseProjectAddUp) return

  t.is(baseProjectAddUp.expenses.amount, 50)
  t.is(baseProjectAddUp.total.amount, 50)
  t.is(baseProjectAddUp.advance.amount, 40)
  t.is(baseProjectAddUp.balance.amount, 10)
  t.false(baseProjectAddUp.advanceOverflow)

  const secondaryProjectAddUp = result.find((entry) => resolveProjectId(entry.project) === projectB._id)
  t.truthy(secondaryProjectAddUp)
  if (!secondaryProjectAddUp) return

  t.is(secondaryProjectAddUp.expenses.amount, -70)
  t.is(secondaryProjectAddUp.total.amount, 0)
  t.is(secondaryProjectAddUp.advance.amount, 25)
  t.is(secondaryProjectAddUp.balance.amount, 0)
  t.true(secondaryProjectAddUp.advanceOverflow)
})

test('addUp sums travel lump sums, applies professional share, and splits by project', (t) => {
  const projectA = createProject('A')
  const projectB = createProject('B')
  const projectC = createProject('C')

  const travel: AddUpTravel = {
    project: projectA,
    startDate: new Date('2024-01-01').toISOString(),
    stages: [
      {
        _id: 'stage-1',
        departure: new Date('2024-01-01').toISOString(),
        arrival: new Date('2024-01-01').toISOString(),
        startLocation: place,
        endLocation: place,
        transport: { type: 'airplane' },
        cost: createCost(200),
        purpose: 'mixed',
        project: projectB,
        note: null
      }
    ],
    expenses: [
      { _id: 'texp-1', description: 'Mixed expense on main project', cost: createCost(100), note: null, project: null, purpose: 'mixed' },
      {
        _id: 'texp-2',
        description: 'Professional expense on third project',
        cost: createCost(25),
        note: null,
        project: projectC,
        purpose: 'professional'
      }
    ],
    days: [createTravelDay('day-1', 20, 30), createTravelDay('day-2', 10, 15)],
    professionalShare: 0.4,
    advances: [createAdvance('adv-main', projectA, 30), createAdvance('adv-b', projectB, 50)]
  }

  const result = addUp<Id, AddUpTravel>(travel)

  t.is(result.length, 3)

  const mainAddUp = result.find((entry) => resolveProjectId(entry.project) === projectA._id)
  t.truthy(mainAddUp)
  if (!mainAddUp) return

  t.is(mainAddUp.expenses.amount, 40)
  t.is((mainAddUp as FlatAddUp<Id, AddUpTravel>).lumpSums?.amount, 75)
  t.is(mainAddUp.total.amount, 115)
  t.is(mainAddUp.advance.amount, 30)
  t.is(mainAddUp.balance.amount, 85)
  t.false(mainAddUp.advanceOverflow)

  const stageProjectAddUp = result.find((entry) => resolveProjectId(entry.project) === projectB._id)
  t.truthy(stageProjectAddUp)
  if (!stageProjectAddUp) return

  t.is(stageProjectAddUp.expenses.amount, 80)
  t.is((stageProjectAddUp as FlatAddUp<Id, AddUpTravel>).lumpSums?.amount, 0)
  t.is(stageProjectAddUp.total.amount, 80)
  t.is(stageProjectAddUp.advance.amount, 50)
  t.is(stageProjectAddUp.balance.amount, 30)
  t.false(stageProjectAddUp.advanceOverflow)

  const thirdProjectAddUp = result.find((entry) => resolveProjectId(entry.project) === projectC._id)
  t.truthy(thirdProjectAddUp)
  if (!thirdProjectAddUp) return

  t.is(thirdProjectAddUp.expenses.amount, 25)
  t.is((thirdProjectAddUp as FlatAddUp<Id, AddUpTravel>).lumpSums?.amount, 0)
  t.is(thirdProjectAddUp.total.amount, 25)
  t.is(thirdProjectAddUp.advance.amount, 0)
  t.is(thirdProjectAddUp.balance.amount, 25)
  t.false(thirdProjectAddUp.advanceOverflow)
})

test('addUp rounds mixed professional share totals with decimal multiplication', (t) => {
  const projectA = createProject('A')

  const travel: AddUpTravel = {
    project: projectA,
    startDate: new Date('2024-01-01').toISOString(),
    stages: [],
    expenses: [{ _id: 'texp-1', description: 'Mixed expense', cost: createCost(2.01), note: null, project: null, purpose: 'mixed' }],
    days: [],
    professionalShare: 0.5,
    advances: []
  }

  const result = addUp<Id, AddUpTravel>(travel)

  t.is(result.length, 1)
  t.is(result[0].expenses.amount, 1.005)
  t.is(result[0].total.amount, 1.01)
  t.is(result[0].balance.amount, 1.01)
  t.false(result[0].negativeTotal)
})

test('addUp keeps totals numeric when travel lump sums are invalid', (t) => {
  const projectA = createProject('A')
  const invalidDay = createTravelDay('day-1', 20, 30)
  ;(invalidDay.lumpSums.catering.refund as { amount?: number }).amount = undefined

  const travel: AddUpTravel = {
    project: projectA,
    startDate: new Date('2024-01-01').toISOString(),
    stages: [
      {
        _id: 'stage-1',
        departure: new Date('2024-01-01T08:00:00.000Z').toISOString(),
        arrival: new Date('2024-01-01T12:00:00.000Z').toISOString(),
        startLocation: place,
        endLocation: place,
        transport: { type: 'airplane' },
        cost: createCost(100),
        purpose: 'professional',
        project: null,
        note: null
      },
      {
        _id: 'stage-2',
        departure: new Date('2024-01-01T10:00:00.000Z').toISOString(),
        arrival: new Date('2024-01-01T14:00:00.000Z').toISOString(),
        startLocation: place,
        endLocation: place,
        transport: { type: 'airplane' },
        cost: createCost(20),
        purpose: 'professional',
        project: null,
        note: null
      }
    ],
    expenses: [],
    days: [invalidDay],
    professionalShare: 1,
    advances: [createAdvance('adv-main', projectA, 30)]
  }

  const result = addUp<Id, AddUpTravel>(travel)

  t.is(result.length, 1)
  t.true(Number.isNaN((result[0] as FlatAddUp<Id, AddUpTravel>).lumpSums?.amount))
  t.is(result[0].total.amount, 120)
  t.is(result[0].balance.amount, 90)
})

test('addUp ignores tiny negative float remainders after cent rounding', (t) => {
  const projectA = createProject('A')

  const expenseReport: AddUpReport = {
    project: projectA,
    expenses: [
      { _id: 'e1', description: 'Expense', cost: createCost(0.1), note: null, project: null },
      { _id: 'e2', description: 'Refund', cost: createCost(-0.1001), note: null, project: null }
    ],
    advances: []
  }

  const result = addUp<Id, AddUpReport>(expenseReport)

  t.is(result.length, 1)
  t.is(result[0].total.amount, 0)
  t.is(result[0].balance.amount, 0)
  t.false(result[0].negativeTotal)
  t.false(result[0].advanceOverflow)
})

test('addUp still flags totals that are negative after cent rounding', (t) => {
  const projectA = createProject('A')

  const expenseReport: AddUpReport = {
    project: projectA,
    expenses: [
      { _id: 'e1', description: 'Expense', cost: createCost(0.1), note: null, project: null },
      { _id: 'e2', description: 'Refund', cost: createCost(-0.105), note: null, project: null }
    ],
    advances: []
  }

  const result = addUp<Id, AddUpReport>(expenseReport)

  t.is(result.length, 1)
  t.is(result[0].total.amount, 0)
  t.is(result[0].balance.amount, 0)
  t.true(result[0].negativeTotal)
})
