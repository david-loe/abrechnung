import test from 'ava'
import {
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

const DE = { _id: 'DE', name: { de: 'Deutschland', en: 'Germany' }, flag: '🇩🇪' }

const place = { place: 'Berlin', country: DE }

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
