import test from 'ava'
import { emailRegex, objectIdRegex, hexColorRegex } from './types.js'

test('emailRegex validates emails', (t) => {
  t.true(emailRegex.test('user@example.com'))
  t.false(emailRegex.test('invalid@'))
})

test('objectIdRegex validates mongo ids', (t) => {
  t.true(objectIdRegex.test('0123456789abcdefabcdef12'))
  t.false(objectIdRegex.test('xyz'))
})

test('hexColorRegex validates colors', (t) => {
  t.true(hexColorRegex.test('#aabbcc'))
  t.true(hexColorRegex.test('#abc'))
  t.false(hexColorRegex.test('123456'))
})
