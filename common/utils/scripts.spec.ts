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
  objectsToCSV,
  PlaceToString
} from './scripts.js'

type Id = string

const DE: CountrySimple = { _id: 'DE', name: { de: 'Deutschland', en: 'Germany' }, flag: '🇩🇪' }

const place: Place = { place: 'Berlin', country: DE }

test('PlaceToString formats place', (t) => {
  t.is(PlaceToString(place), 'Berlin, DE 🇩🇪')
  t.is(PlaceToString(place, 'en'), 'Berlin, Germany 🇩🇪')
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
