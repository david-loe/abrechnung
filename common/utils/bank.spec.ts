import test from 'ava'
import { isValidBic, isValidIban, maskIban, normalizeBic, normalizeIban } from './bank.js'

test('normalizes and validates IBANs', (t) => {
  t.is(normalizeIban('de89 3704 0044 0532 0130 00'), 'DE89370400440532013000')
  t.true(isValidIban('DE89 3704 0044 0532 0130 00'))
  t.false(isValidIban('DE89 3704 0044 0532 0130 01'))
  t.false(isValidIban('not-an-iban'))
})

test('normalizes and validates optional BIC values', (t) => {
  t.is(normalizeBic('cobadeff xxx'), 'COBADEFFXXX')
  t.true(isValidBic('COBADEFF'))
  t.true(isValidBic('COBADEFFXXX'))
  t.false(isValidBic('COBA-DEFF'))
})

test('masks an IBAN except for country and final digits', (t) => {
  t.is(maskIban('DE89370400440532013000'), 'DE••••••••••••••••3000')
  t.true(maskIban('DE89370400440532013000').endsWith('3000'))
})
