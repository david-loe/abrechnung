import test from 'ava'
import { getByPath, sortByPath } from './sort.js'

interface Row {
  id: string
  value?: string | number | null | boolean | Date
  nested?: { key?: string | null; items?: Array<{ price: number }> }
}

test('getByPath resolves nested fields and array indices', (t) => {
  const row: Row = { id: 'a', nested: { key: 'hello', items: [{ price: 5 }, { price: 9 }] } }

  t.is(getByPath(row, 'nested.key'), 'hello')
  t.is(getByPath(row, 'nested.items.1.price'), 9)
  t.is(getByPath(row, 'nested.missing'), undefined)
  t.deepEqual(getByPath(row, ''), row)
})

test('sortByPath sorts by numeric strings by default (numericString=true)', (t) => {
  const rows: Row[] = [
    { id: 'a', value: '10' },
    { id: 'b', value: '2' },
    { id: 'c', value: '1' }
  ]

  const sorted = sortByPath(rows, 'value')

  t.deepEqual(
    sorted.map((x) => x.id),
    ['c', 'b', 'a']
  )
})

test('sortByPath supports lexical string sorting with numericString=false', (t) => {
  const rows: Row[] = [
    { id: 'a', value: '10' },
    { id: 'b', value: '2' },
    { id: 'c', value: '1' }
  ]

  const sorted = sortByPath(rows, 'value', { numericString: false })

  t.deepEqual(
    sorted.map((x) => x.id),
    ['c', 'a', 'b']
  )
})

test('sortByPath handles null values and descending order', (t) => {
  const rows: Row[] = [
    { id: 'a', value: null },
    { id: 'b', value: 2 },
    { id: 'c', value: 1 }
  ]

  const defaultNulls = sortByPath(rows, 'value')
  t.deepEqual(
    defaultNulls.map((x) => x.id),
    ['c', 'b', 'a']
  )

  const nullsFirstDesc = sortByPath(rows, 'value', { nulls: 'first', order: 'desc' })
  t.deepEqual(
    nullsFirstDesc.map((x) => x.id),
    ['a', 'b', 'c']
  )
})

test('sortByPath keeps original order for equal keys (stable sort)', (t) => {
  const rows: Row[] = [
    { id: 'a', value: 1 },
    { id: 'b', value: 1 },
    { id: 'c', value: 1 }
  ]

  const sorted = sortByPath(rows, 'value')

  t.deepEqual(
    sorted.map((x) => x.id),
    ['a', 'b', 'c']
  )
})

test('sortByPath is non-mutating', (t) => {
  const rows: Row[] = [
    { id: 'a', value: 3 },
    { id: 'b', value: 1 },
    { id: 'c', value: 2 }
  ]

  const originalOrder = rows.map((x) => x.id)
  const sorted = sortByPath(rows, 'value')

  t.deepEqual(
    rows.map((x) => x.id),
    originalOrder
  )
  t.deepEqual(
    sorted.map((x) => x.id),
    ['b', 'c', 'a']
  )
})
