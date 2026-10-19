import { Category, Expense } from 'abrechnung-common/types.js'
import { describe, expect, it } from 'vitest'
import { getPositionCategory, replaceReportCategory } from '@/components/elements/costPositionCategory.js'

const expense = { _id: 'expense', for: 'ExpenseReport', isDefault: true } as Category<string>
const other = { _id: 'other', for: 'ExpenseReport', isDefault: false } as Category<string>
const travel = { _id: 'travel', for: 'Travel', isDefault: true } as Category<string>
const both = { _id: 'both', for: 'both', isDefault: false } as Category<string>

describe('cost position category selection', () => {
  it('prefers the report category over the global category', () => {
    expect(getPositionCategory([expense, other, travel], 'ExpenseReport', other)).toBe(other)
  })

  it('keeps the global selection when the report has no category', () => {
    expect(getPositionCategory([expense, other, travel], 'ExpenseReport')).toBe(expense)
    expect(getPositionCategory([expense, travel], 'Travel')).toBe(travel)
  })

  it('selects the only applicable category, including categories for both report types', () => {
    expect(getPositionCategory([travel, other], 'ExpenseReport')).toBe(other)
    expect(getPositionCategory([both], 'ExpenseReport')).toBe(both)
    expect(getPositionCategory([both], 'Travel')).toBe(both)
  })

  it('leaves a choice when there is no unique or global category', () => {
    expect(getPositionCategory([other, both], 'ExpenseReport')).toBeUndefined()
    expect(getPositionCategory([travel], 'ExpenseReport')).toBeUndefined()
  })
})

describe('report category replacement', () => {
  const expenses = [
    {
      _id: 'first',
      description: 'Office supplies',
      note: 'Keep this note',
      cost: {
        currency: { _id: 'EUR' },
        date: '2026-01-01',
        receipts: [{ _id: 'receipt' }],
        positions: [
          { _id: 'one', category: expense, grossAmount: 10, vatRate: 19 },
          { _id: 'two', category: both, grossAmount: 20, vatRate: 0 }
        ]
      }
    },
    { _id: 'second', cost: { positions: [{ category: { ...expense }, grossAmount: 30 }] } },
    { _id: 'unaffected', cost: { positions: [{ category: both }] } }
  ] as Expense<string>[]

  it('replaces matching positions across expenses while preserving overrides and all other data', () => {
    const original = structuredClone(expenses)
    const result = replaceReportCategory(expenses, { ...expense }, other)
    expect(result).toEqual([
      {
        ...expenses[0],
        cost: { ...expenses[0].cost, positions: [{ ...expenses[0].cost.positions[0], category: other }, expenses[0].cost.positions[1]] }
      },
      { ...expenses[1], cost: { ...expenses[1].cost, positions: [{ ...expenses[1].cost.positions[0], category: other }] } }
    ])
    expect(expenses).toEqual(original)
    expect(result[0]).not.toBe(expenses[0])
    expect(result[0].cost).not.toBe(expenses[0].cost)
    expect(result[0].cost.positions[0]).not.toBe(expenses[0].cost.positions[0])
  })

  it.each([
    [undefined, other],
    [null, other],
    [expense, undefined],
    [expense, null],
    [expense, { ...expense }],
    [travel, other]
  ])('does not update positions when replacement is unnecessary (%j → %j)', (previous, next) => {
    expect(replaceReportCategory(expenses, previous, next)).toEqual([])
  })

  it('does not create expenses in an empty report', () => {
    expect(replaceReportCategory([], expense, other)).toEqual([])
  })
})
