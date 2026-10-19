import { Category, ExpenseReport } from 'abrechnung-common/types.js'
import { describe, expect, it, vi } from 'vitest'
import API from '@/api.js'
import { saveExpenseReportDetails } from '@/components/expenseReport/scripts.js'

vi.mock('@/api.js', () => ({ default: { setter: vi.fn() } }))

const previous = { _id: 'previous' } as Category<string>
const next = { _id: 'next' } as Category<string>

function fixture() {
  const expense = {
    _id: 'first',
    description: 'Supplies',
    note: 'Keep this note',
    cost: {
      currency: { _id: 'EUR' },
      date: '2026-01-01',
      receipts: [{ _id: 'receipt', name: 'Receipt.pdf', type: 'application/pdf' }],
      positions: [{ _id: 'position', category: previous, grossAmount: 10, vatRate: 0 }]
    }
  }
  return {
    _id: 'report',
    category: previous,
    expenses: [expense, { ...expense, _id: 'second' }, { ...expense, _id: 'unaffected', cost: { ...expense.cost, positions: [] } }]
  } as ExpenseReport<string>
}

describe('saving report category changes', () => {
  it.each(['', 'examine/'])('saves affected expenses sequentially before the details with prefix %j', async (prefix) => {
    const report = fixture()
    const updatedReport = { _id: report._id, category: next }
    const saved = { ok: { ...report, category: next } }
    let resolveFirst!: (result: { ok: ExpenseReport<string> }) => void
    vi.mocked(API.setter).mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
    vi.mocked(API.setter).mockResolvedValue(saved)

    const pending = saveExpenseReportDetails(report, updatedReport, prefix)
    expect(API.setter).toHaveBeenCalledTimes(1)
    const first = vi.mocked(API.setter).mock.calls[0]
    expect(first[0]).toBe(`${prefix}expenseReport/expense`)
    expect(first[1]).toEqual({
      ...report.expenses[0],
      cost: { ...report.expenses[0].cost, positions: [{ ...report.expenses[0].cost.positions[0], category: next }] }
    })
    expect(first[2]).toEqual({ headers: { 'Content-Type': 'multipart/form-data' }, params: { parentId: report._id } })
    resolveFirst({ ok: report })
    expect(await pending).toBe(saved)
    expect(API.setter).toHaveBeenCalledTimes(3)
    expect(vi.mocked(API.setter).mock.calls[1][0]).toBe(`${prefix}expenseReport/expense`)
    expect(API.setter).toHaveBeenLastCalledWith(`${prefix}expenseReport${prefix ? '' : '/inWork'}`, updatedReport)
    expect(report.expenses[0].cost.positions[0].category).toBe(previous)
  })

  it.each([undefined, null, previous])('only saves details when the category is %j', async (category) => {
    const report = fixture()
    const updatedReport = { _id: report._id, category }
    vi.mocked(API.setter).mockResolvedValue({ ok: report })
    await saveExpenseReportDetails(report, updatedReport)
    expect(API.setter).toHaveBeenCalledExactlyOnceWith('expenseReport/inWork', updatedReport)
  })

  it.each([0, 1])('stops on expense failure at index %i without saving details', async (index) => {
    const report = fixture()
    const failed = { error: new Error('Saving failed') }
    vi.mocked(API.setter).mockResolvedValue(failed)
    if (index) vi.mocked(API.setter).mockResolvedValueOnce({ ok: report })
    expect(await saveExpenseReportDetails(report, { _id: report._id, category: next })).toBe(failed)
    expect(API.setter).toHaveBeenCalledTimes(index + 1)
    expect(vi.mocked(API.setter).mock.calls.every(([endpoint]) => endpoint === 'expenseReport/expense')).toBe(true)
  })

  it('returns a details failure after saving positions and supports retrying with the server state', async () => {
    const report = fixture()
    const failed = { error: new Error('Details failed') }
    vi.mocked(API.setter).mockResolvedValueOnce({ ok: report }).mockResolvedValueOnce({ ok: report }).mockResolvedValueOnce(failed)
    expect(await saveExpenseReportDetails(report, { _id: report._id, category: next })).toBe(failed)

    const reloaded = structuredClone(report)
    for (const expense of reloaded.expenses) {
      for (const position of expense.cost.positions) position.category = next
    }
    vi.mocked(API.setter).mockClear().mockResolvedValue({ ok: reloaded })
    await saveExpenseReportDetails(reloaded, { _id: report._id, category: next })
    expect(API.setter).toHaveBeenCalledExactlyOnceWith('expenseReport/inWork', { _id: report._id, category: next })
  })
})
