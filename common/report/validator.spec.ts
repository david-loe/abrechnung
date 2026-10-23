import test from 'ava'
import { baseCurrency, Category, ProjectSimple } from '../types.js'
import { getCostExchangeRateValidationResults, Validator } from './validator.js'

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

const foreignExpenseReport = {
  currency: { ...baseCurrency, _id: 'USD' },
  exchangeRateDate: new Date('2024-01-01'),
  exchangeRate: null,
  advances: [],
  expenses: [
    {
      description: 'Taxi',
      cost: {
        positions: [{ _id: 'position', kind: 'manual' as const, grossAmount: 12, vatRate: 0, project, category }],
        currency: { ...baseCurrency, _id: 'USD' },
        date: new Date('2024-01-01'),
        receipts: []
      },
      _id: 'expense'
    }
  ]
}

test('foreign expense report validation allows a missing shared exchange rate before completion', (t) => {
  const validator = new Validator({ requireReceipts: false })

  t.deepEqual(validator.getValidationResults(foreignExpenseReport), [])
})

test('foreign expense report completion validation requires the shared exchange rate', (t) => {
  const validator = new Validator({ requireExchangeRate: true, requireReceipts: false })
  const results = validator.getValidationResults(foreignExpenseReport)

  t.deepEqual(results, [{ code: 'exchangeRateUnavailable', severity: 'error', path: 'exchangeRateDate' }])
})

test('foreign expense report completion validation requires an exchange rate date without duplicating the error', (t) => {
  const validator = new Validator({ requireExchangeRate: true, requireReceipts: false })
  const USD = { ...baseCurrency, _id: 'USD' }
  const results = validator.getValidationResults({
    currency: USD,
    exchangeRateDate: null,
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

  t.deepEqual(results, [{ code: 'required', severity: 'error', path: 'exchangeRateDate' }])
})

test('completion requires conversions for foreign costs, including offsetting positions', (t) => {
  const cost = foreignExpenseReport.expenses[0].cost
  const path = 'expenses.0.cost'
  t.deepEqual(getCostExchangeRateValidationResults(cost, path), [
    { code: 'exchangeRateUnavailable', severity: 'error', path: `${path}.exchangeRate` }
  ])
  t.deepEqual(getCostExchangeRateValidationResults({ ...cost, currency: baseCurrency }, path), [])
  t.deepEqual(getCostExchangeRateValidationResults({ ...cost, positions: [] }, path), [])
  t.deepEqual(getCostExchangeRateValidationResults({ ...cost, positions: [{ ...cost.positions[0], grossAmount: 0 }] }, path), [])
  t.is(
    getCostExchangeRateValidationResults({ ...cost, positions: [cost.positions[0], { ...cost.positions[0], grossAmount: -12 }] }, path)
      .length,
    1
  )
  for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    t.is(getCostExchangeRateValidationResults({ ...cost, exchangeRate: { date: new Date(), rate } }, path).length, 1)
  }
  t.deepEqual(getCostExchangeRateValidationResults({ ...cost, exchangeRate: { date: new Date(), rate: 0.9 } }, path), [])
})
