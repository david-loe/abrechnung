import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test from 'ava'
import { Schema } from 'mongoose'
import { ValidationClientError } from '../controller/error.js'
import { parseGetterFilter } from '../controller/getterFilter.js'

const schema = new Schema({
  name: { givenName: String, familyName: String },
  details: { visible: String, hidden: String },
  rows: [{ visible: String, hidden: String }],
  log: { '10': { by: String }, '20': { by: String } }
})

test('getter filter parsing preserves literal values and existing Base64 Unicode encoding', (t) => {
  const filter = { name: { givenName: 'Jörg 🧾', familyName: 'Visible' } }
  t.deepEqual(parseGetterFilter(Base64.encode(JSON.stringify(filter)), { name: 1 }, schema), filter)
})

test('getter filters respect implicit, included and excluded IDs', (t) => {
  const filter = Base64.encode(JSON.stringify({ _id: '012345678901234567890123' }))
  for (const projection of [{ name: 1 }, { _id: 1 }, { 'details.hidden': 0 }]) {
    t.deepEqual(parseGetterFilter(filter, projection, schema), { _id: '012345678901234567890123' })
  }
  for (const projection of [{ name: 1, _id: 0 }, { _id: false }]) {
    const error = t.throws(() => parseGetterFilter(filter, projection, schema), { instanceOf: ValidationClientError })
    t.is(error.status, 422)
  }
  t.throws(() => parseGetterFilter(Base64.encode('{"name.givenName":"Jörg"}'), { _id: 1 }, schema), { instanceOf: ValidationClientError })
})

test('nested exclusions reject ancestors and descendants while retaining visible siblings', (t) => {
  const projection = { 'details.hidden': false, 'rows.hidden': 0 }
  for (const filter of [
    { 'details.visible': 'Visible' },
    { 'rows.0.visible': 'Visible' },
    { rows: { $elemMatch: { visible: 'Visible' } } }
  ]) {
    t.deepEqual(parseGetterFilter(Base64.encode(JSON.stringify(filter)), projection, schema), filter)
  }
  for (const filter of [
    { details: { visible: 'Visible' } },
    { 'details.hidden.nested': 'Hidden' },
    { rows: { $eq: [{ visible: 'Visible' }] } },
    { rows: { $elemMatch: { hidden: 'Hidden' } } },
    { 'rows.0.hidden': 'Hidden' }
  ]) {
    t.throws(() => parseGetterFilter(Base64.encode(JSON.stringify(filter)), projection, schema), { instanceOf: ValidationClientError })
  }
})

test('explicit ID inclusion retains exclusion projection semantics for other fields', (t) => {
  const projection = { _id: 1, 'details.hidden': 0 }
  const filter = { 'details.visible': 'Visible' }
  t.deepEqual(parseGetterFilter(Base64.encode(JSON.stringify(filter)), projection, schema), filter)
  t.throws(() => parseGetterFilter(Base64.encode('{"details.hidden":"Hidden"}'), projection, schema), { instanceOf: ValidationClientError })
})

test('numeric workflow keys remain distinct from numeric array indices', (t) => {
  const filter = { 'log.10.by': 'Visible' }
  t.deepEqual(parseGetterFilter(Base64.encode(JSON.stringify(filter)), { 'log.10.by': 1 }, schema), filter)
  t.throws(() => parseGetterFilter(Base64.encode('{"log.20.by":"Hidden"}'), { 'log.10.by': 1 }, schema), {
    instanceOf: ValidationClientError
  })
})
