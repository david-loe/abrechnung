import test from 'ava'
import { baseCurrency } from '../types.js'
import { Validator } from './validator.js'

test('expense validation requires receipts for review', (t) => {
  const validator = new Validator({ requireReceipts: true })
  const expense = {
    description: 'Taxi',
    cost: { amount: 12, currency: baseCurrency, date: new Date('2024-01-01'), receipts: [] }
  } as Parameters<typeof validator.getExpenseValidationResults>[0]

  const results = validator.getExpenseValidationResults(expense)

  t.deepEqual(results, [{ code: 'requiredForReview', severity: 'error', path: 'cost.receipts', reference: undefined }])
})
