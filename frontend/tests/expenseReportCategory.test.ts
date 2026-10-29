import { type Category, type ExpenseReport } from 'abrechnung-common/types.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { saveExpenseReportDetails } from '@/components/expenseReport/scripts.js'
import { clearStore } from '@/indexedDB.js'
import { requestBody, serve } from './http.js'

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

// This server boundary models persistence and failures, not the client's replacement rule.
function server(report: ExpenseReport<string>, failure?: string, prefix = '') {
  const saved = structuredClone(report)
  serve((request) => {
    const body = requestBody(request)
    if (request.method !== 'post') return { status: 405, data: { message: 'Method not allowed' } }
    if (request.url === `http://backend.test/${prefix}expenseReport/expense`) {
      if (request.params?.parentId !== report._id) return { status: 422, data: { message: 'Invalid parent ID' } }
      const id = body instanceof Object ? body._id : undefined
      if (failure === id) return { status: 422, data: { message: 'Expense rejected' } }
      const index = saved.expenses.findIndex((expense) => expense._id === id)
      if (index < 0) return { status: 404, data: { message: 'Unknown expense' } }
      // Receipts use the multipart wire format, decoded just as a server would.
      saved.expenses[index] = body
    } else if (request.url === `http://backend.test/${prefix}expenseReport${prefix === 'examine/' ? '' : '/inWork'}`) {
      if (failure === 'details') return { status: 422, data: { message: 'Details rejected' } }
      Object.assign(saved, body)
    } else {
      return { status: 404, data: { message: 'Unknown endpoint' } }
    }
    return { data: { message: 'alerts.successSaving', result: saved } }
  })
  return saved
}

beforeEach(async () => {
  await clearStore('session')
  window.dispatchEvent(new Event('online'))
})

describe('saving report category changes through the HTTP boundary', () => {
  it.each(['', 'examine/'])('given affected and overridden positions, saving %j preserves receipts and unrelated data', async (prefix) => {
    const report = fixture()
    const original = structuredClone(report)
    const saved = server(report, undefined, prefix)
    const result = await saveExpenseReportDetails(report, { _id: report._id, category: next }, prefix)
    expect(result.error).toBeUndefined()
    expect(saved.category).toEqual(next)
    expect(saved.expenses[0].cost.positions[0].category).toEqual(next)
    expect(saved.expenses[1].cost.positions[0].category).toEqual(next)
    expect(saved.expenses[2]).toEqual(original.expenses[2])
    expect(saved.expenses[0].description).toBe('Supplies')
    expect(saved.expenses[0].note).toBe('Keep this note')
    expect(saved.expenses[0].cost.receipts).toEqual(original.expenses[0].cost.receipts)
    expect(report).toEqual(original)
  })
  it.each([undefined, null, previous])('given unchanged or cleared category %j, positions keep their categories', async (category) => {
    const report = fixture()
    const saved = server(report)
    expect((await saveExpenseReportDetails(report, { _id: report._id, category })).error).toBeUndefined()
    expect(saved.expenses).toEqual(report.expenses)
    expect(saved.category).toEqual(category === undefined ? previous : category)
  })
  it.each(['first', 'second'])('given rejection of expense %s, report details and later expenses are not changed', async (id) => {
    const report = fixture()
    const saved = server(report, id)
    expect((await saveExpenseReportDetails(report, { _id: report._id, category: next })).error).toEqual({ message: 'Expense rejected' })
    expect(saved.category).toEqual(previous)
    expect(saved.expenses[1]).toEqual(report.expenses[1])
    expect(saved.expenses[0].cost.positions[0].category).toEqual(id === 'first' ? previous : next)
  })
  it('given a details failure after positions were saved, retrying the reloaded state completes the change', async () => {
    const report = fixture()
    const saved = server(report, 'details')
    expect((await saveExpenseReportDetails(report, { _id: report._id, category: next })).error).toEqual({ message: 'Details rejected' })
    expect(saved.category).toEqual(previous)
    expect(saved.expenses[0].cost.positions[0].category).toEqual(next)
    const retried = server(saved)
    expect((await saveExpenseReportDetails(saved, { _id: report._id, category: next })).error).toBeUndefined()
    expect(retried.category).toEqual(next)
    expect(retried.expenses).toEqual(saved.expenses)
  })
})
