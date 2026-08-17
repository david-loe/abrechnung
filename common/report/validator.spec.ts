import test from 'ava'
import { baseCurrency, Category, ProjectSimple } from '../types.js'
import { Validator } from './validator.js'

const project = { _id: 'project', name: 'Project', identifier: 'project', organisation: 'organisation' } as ProjectSimple<string>
const category = { _id: 'category', name: 'Category' } as Category<string>

test('expense validation requires receipts for review', (t) => {
  const validator = new Validator({ requireReceipts: true })
  const expense = {
    description: 'Taxi',
    cost: {
      positions: [{ _id: 'position', kind: 'manual', grossAmount: 12, vatRate: 0, project, category }],
      currency: baseCurrency,
      date: new Date('2024-01-01'),
      receipts: []
    }
  } as Parameters<typeof validator.getExpenseValidationResults>[0]

  const results = validator.getExpenseValidationResults(expense)

  t.deepEqual(results, [{ code: 'requiredForReview', severity: 'error', path: 'cost.receipts', reference: undefined }])
})

test('foreign expense report validation requires the shared exchange rate', (t) => {
  const validator = new Validator({ requireReceipts: false })
  const USD = { ...baseCurrency, _id: 'USD' }
  const results = validator.getValidationResults({
    currency: USD,
    exchangeRateDate: new Date('2024-01-01'),
    exchangeRate: null,
    advances: [],
    expenses: [
      {
        description: 'Taxi',
        cost: {
          positions: [{ _id: 'position', kind: 'manual', grossAmount: 12, vatRate: 0, project, category }],
          currency: USD,
          date: new Date('2024-01-01'),
          receipts: []
        },
        _id: 'expense'
      }
    ]
  })

  t.deepEqual(results, [{ code: 'exchangeRateUnavailable', severity: 'error', path: 'exchangeRateDate' }])
})
