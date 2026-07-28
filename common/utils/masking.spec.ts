import test from 'ava'
import { maskValue } from './masking.js'

test('masks complete values or keeps configured edges visible', (t) => {
  t.is(maskValue('secret', { maskedLength: 8 }), '********')
  t.is(maskValue('DE89370400440532013000', { visibleStart: 2, visibleEnd: 4, character: '•' }), 'DE••••••••••••••••3000')
  t.is(maskValue('abc', { visibleStart: 2, visibleEnd: 2 }), 'abc')
})
