import assert from 'node:assert/strict'
import test from 'ava'
import fc from 'fast-check'
import { type AddUpReport, type AddUpTravel, baseCurrency, idDocumentToId } from '../types.js'
import { CurrencyConverter, ExchangeRateProvider } from './currencyConverter.js'
import {
  addUp,
  getCostGrossAmount,
  getCostPositionNetAmount,
  getCostPositionVatAmount,
  multiplyAmountAndRound,
  roundAmount,
  subtractAmounts,
  sumAmounts
} from './scripts.js'

const parameters = {
  numRuns: 500,
  ...(process.env.FC_SEED ? { seed: Number(process.env.FC_SEED) } : {}),
  ...(process.env.FC_PATH ? { path: process.env.FC_PATH } : {})
}
const cents = fc.integer({ min: -100_000_000, max: 100_000_000 })
const rateUnits = fc.integer({ min: 1, max: 100_000 })

// Independent integer oracle: round a rational number to cents, ties away from zero.
function roundedQuotient(numerator: bigint, denominator: bigint) {
  const sign = numerator < 0n ? -1n : 1n
  const absolute = numerator * sign
  return Number(sign * ((2n * absolute + denominator) / (2n * denominator))) / 100
}

test('money: rounding mill amounts uses half-up cents and never produces negative zero', (t) => {
  fc.assert(
    fc.property(cents, (mills) => {
      const actual = roundAmount(mills / 1000)
      assert.equal(actual, roundedQuotient(BigInt(mills), 10n))
      assert.equal(roundAmount(actual), actual)
      assert.equal(Object.is(actual, -0), false)
    }),
    parameters
  )
  t.pass()
})

test('money: summing cent amounts preserves the exact total regardless of order', (t) => {
  fc.assert(
    fc.property(fc.array(cents, { maxLength: 50 }), (values) => {
      const amounts = values.map((value) => value / 100)
      const expected = values.reduce((total, value) => total + value, 0) / 100
      assert.equal(sumAmounts(...amounts), expected)
      assert.equal(sumAmounts(...amounts.reverse()), expected)
    }),
    parameters
  )
  t.pass()
})

test('money: subtraction reverses a sum of cent amounts', (t) => {
  fc.assert(
    fc.property(cents, cents, (left, right) => subtractAmounts(sumAmounts(left / 100, right / 100), right / 100) === left / 100),
    parameters
  )
  t.pass()
})

test('money: multiplication rounds once after applying a positive decimal factor', (t) => {
  fc.assert(
    fc.property(cents, rateUnits, (amount, factor) => {
      assert.equal(multiplyAmountAndRound(amount / 100, factor / 10_000), roundedQuotient(BigInt(amount) * BigInt(factor), 10_000n))
    }),
    parameters
  )
  t.pass()
})

test('money: currency conversion preserves the selected rate and independently rounded amount', async (t) => {
  await fc.assert(
    fc.asyncProperty(cents, rateUnits, async (amount, rate) => {
      const converter = new CurrencyConverter('InforEuro', [
        new ExchangeRateProvider('InforEuro', async () => ({ rate: rate / 10_000, rates: null }))
      ])
      const converted = await converter.convert(new Date('2024-01-01'), amount / 100, 'USD', 'EUR')
      assert.equal(converted?.amount, roundedQuotient(BigInt(amount) * BigInt(rate), 10_000n))
      assert.equal(converted?.rate, rate / 10_000)
    }),
    parameters
  )
  t.pass()
})

test('money: VAT and net conserve gross cents, including credits and disabled VAT', (t) => {
  fc.assert(
    fc.property(cents, fc.constantFrom(0, 7, 19, 20), (amount, vatRate) => {
      const position = { grossAmount: amount / 100, vatRate }
      const expectedVat = roundedQuotient(BigInt(amount) * BigInt(vatRate), BigInt(100 + vatRate))
      assert.equal(getCostPositionVatAmount(position, true), expectedVat)
      assert.equal(Math.round(getCostPositionNetAmount(position, true) * 100) + Math.round(expectedVat * 100), amount)
      assert.equal(getCostPositionVatAmount(position, false), 0)
      assert.equal(getCostPositionNetAmount(position, false), amount / 100)
    }),
    parameters
  )
  t.pass()
})

test('money: a valid manual VAT override determines the net amount', (t) => {
  fc.assert(
    fc.property(cents, fc.integer({ min: 0, max: 100 }), (amount, percentage) => {
      const vatCents = Number((BigInt(amount) * BigInt(percentage)) / 100n)
      const position = { grossAmount: amount / 100, vatRate: 19, vatAmountOverride: vatCents / 100 }
      assert.equal(getCostPositionVatAmount(position, true), vatCents / 100)
      assert.equal(getCostPositionNetAmount(position, true), (amount - vatCents) / 100)
    }),
    parameters
  )
  t.pass()
})

test('money: project allocation preserves signed expenses and prevents negative reimbursements', (t) => {
  const project = (id: string) => ({ _id: id, identifier: id, organisation: 'org', balance: { amount: 0 } })
  const category = {
    _id: 'category',
    name: 'Expenses',
    style: { color: '#000' as const, text: 'white' as const },
    ledgerAccount: { _id: 'ledger', identifier: '4900', name: 'Expense' },
    isDefault: true,
    for: 'ExpenseReport' as const
  }
  fc.assert(
    fc.property(fc.array(fc.tuple(cents, fc.constantFrom('A', 'B', 'C')), { minLength: 1, maxLength: 30 }), (values) => {
      const cost = {
        currency: baseCurrency,
        date: new Date('2024-01-01'),
        receipts: [],
        positions: values.map(([amount, id], index) => ({
          _id: `${index}`,
          kind: 'manual' as const,
          grossAmount: amount / 100,
          vatRate: 0,
          project: project(id),
          category
        }))
      }
      const report: AddUpReport = { project: project('A'), advances: [], expenses: [{ _id: 'expense', description: 'Example', cost }] }
      const result = addUp(report)
      const expected = values.reduce((total, [amount]) => total + amount, 0)
      assert.equal(getCostGrossAmount(cost), expected / 100)
      assert.equal(
        result.reduce((total, row) => total + Math.round(row.expenses.amount * 100), 0),
        expected
      )
      for (const row of result) {
        const projectCents = values.filter(([, id]) => id === idDocumentToId(row.project)).reduce((total, [amount]) => total + amount, 0)
        assert.equal(Math.round(row.total.amount * 100), Math.max(projectCents, 0))
        assert.equal(Math.round(row.balance.amount * 100), Math.max(projectCents, 0))
        assert.equal(row.negativeTotal, projectCents < 0)
      }
    }),
    parameters
  )
  t.pass()
})

test('money: mixed travel costs respect every professional share, including zero', (t) => {
  fc.assert(
    fc.property(
      fc.array(fc.nat({ max: 1_000_000 }), { minLength: 1, maxLength: 20 }),
      fc.integer({ min: 0, max: 100 }),
      fc.boolean(),
      (amounts, percentage, asStages) => {
        const project = { _id: 'project', identifier: 'PROJECT', organisation: 'org', balance: { amount: 0 } }
        const category = {
          _id: 'category',
          name: 'Expenses',
          style: { color: '#000' as const, text: 'white' as const },
          ledgerAccount: { _id: 'ledger', identifier: '4900', name: 'Expense' },
          isDefault: true,
          for: 'both' as const
        }
        const records = amounts.map((amount, index) => ({
          _id: `${index}`,
          description: 'Mixed travel cost',
          purpose: 'mixed' as const,
          cost: {
            currency: baseCurrency,
            date: '2026-07-01',
            receipts: [],
            positions: [{ _id: `${index}-position`, kind: 'manual' as const, grossAmount: amount / 100, vatRate: 0, project, category }]
          }
        }))
        const country = { _id: 'DE', name: { de: 'Deutschland', en: 'Germany', fr: '', es: '', ru: '', kk: '' } }
        const report: AddUpTravel = {
          project,
          startDate: '2026-07-01',
          days: [],
          professionalShare: percentage / 100,
          advances: [],
          expenses: asStages ? [] : records,
          stages: asStages
            ? records.map((record) => ({
                ...record,
                departure: '2026-07-01T08:00:00Z',
                arrival: '2026-07-01T19:00:00Z',
                startLocation: { country, place: 'Berlin' },
                endLocation: { country, place: 'Berlin' },
                transport: { type: 'otherTransport' }
              }))
            : []
        }
        const [result] = addUp(report)
        const expected = roundedQuotient(amounts.reduce((sum, amount) => sum + BigInt(amount), 0n) * BigInt(percentage), 100n)
        assert.equal(result.total.amount, expected)
        assert.equal(result.balance.amount, expected)
      }
    ),
    {
      ...parameters,
      examples: [
        [[1], 0, false],
        [[1], 0, true]
      ]
    }
  )
  t.pass()
})
