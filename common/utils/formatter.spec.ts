import test from 'ava'
import Formatter from './formatter.js'

test('Formatter formats dates', (t) => {
  const f = new Formatter('en', 'givenNameFirst')
  t.is(f.date('2023-01-02'), '1/2/2023')
  t.is(f.simpleDate('2023-01-02'), '1/2')
  t.is(f.dateTime('2023-01-02T10:05:00Z'), '1/2/2023, 10:05 AM')
  t.is(f.simpleDateTime('2023-01-02T10:05:00Z'), '1/2, 10:05 AM')
})

test('Formatter formats money', (t) => {
  const USD = { _id: 'USD', name: { de: 'Dollar', en: 'Dollar' } }
  const f = new Formatter('en', 'givenNameFirst')
  t.is(f.baseCurrency(10), '€10.00')
  t.is(f.currency(10, 'USD'), '$10.00')
  const m = { amount: 10, currency: USD, exchangeRate: { rate: 0.85, amount: 8.5 } }
  t.is(f.money(m), '€8.50')
  t.is(f.money({ amount: 10, currency: USD }), '$10.00 ⚠')
  t.is(f.detailedMoney(m), '$10.00 * 0.85 = €8.50')
})

test('Formatter formats names', (t) => {
  const f = new Formatter('en', 'givenNameFirst')
  t.is(f.name({ givenName: 'Jane', familyName: 'Doe' }), 'Jane Doe')
  t.is(f.name({ givenName: 'Jane', familyName: 'Doe' }, 'short'), 'Jane D.')
  f.setNameDisplayFormat('familyNameFirst')
  t.is(f.name({ givenName: 'Jane', familyName: 'Doe' }), 'Doe, Jane')
  t.is(f.name({ givenName: 'Jane', familyName: 'Doe' }, 'short'), 'Doe, J.')
})
