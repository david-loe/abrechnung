import { baseCurrency, Category, Cost, Currency, ProjectSimple } from 'abrechnung-common/types.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/api.js', () => ({ default: { setter: vi.fn() } }))

import API from '@/api.js'
import { applySuggestedCost, receiptProcessingStatus, requestReceiptSuggestion, suggestedPlace } from '@/receiptSuggestions.js'

const project = { _id: 'project', identifier: '001', organisation: 'organisation' } satisfies ProjectSimple<string>
const category = {
  _id: 'category',
  name: 'Travel',
  style: { color: '#ffffff', text: 'black' },
  ledgerAccount: { _id: 'ledger' },
  isDefault: true,
  for: 'Travel'
} as Category<string>
const drinksCategory = {
  ...category,
  _id: 'drinks-category',
  name: 'Drinks',
  ledgerAccount: { _id: 'drinks-ledger' },
  isDefault: false
} as Category<string>
const usd = {
  _id: 'USD',
  name: { de: 'US-Dollar', en: 'US dollar', fr: 'dollar américain', es: 'dólar estadounidense', ru: 'доллар США', kk: 'АҚШ доллары' }
} satisfies Currency

function pristineCost() {
  return {
    positions: [{ kind: 'manual', description: '', grossAmount: 0, vatRate: 0, project, category }],
    currency: baseCurrency,
    receipts: [],
    date: ''
  } satisfies Cost<string>
}

describe('receipt suggestion application', () => {
  it('reduces concurrent receipt work to one background status', () => {
    expect(receiptProcessingStatus(['ocr', 'ocr'], false)).toBe('receiptOcrInProgress')
    expect(receiptProcessingStatus(['uploading', 'ocr', 'uploading'], false)).toBe('receiptProcessingInProgress')
    expect(receiptProcessingStatus([], true)).toBe('receiptSuggestionInProgress')
    expect(receiptProcessingStatus([], false, true)).toBe('receiptSuggestionFailed')
  })

  it('posts suggestion parameters without showing an alert', async () => {
    vi.mocked(API.setter).mockResolvedValueOnce({ ok: { type: 'expense' } })

    await requestReceiptSuggestion({
      type: 'expense',
      reportType: 'Travel',
      projectId: 'project',
      documentFileIds: ['first', 'second'],
      sourceReportType: 'Travel',
      endpointPrefix: ''
    })

    expect(vi.mocked(API.setter).mock.calls.at(-1)).toEqual([
      'suggestions',
      { type: 'expense', reportType: 'Travel', projectId: 'project', documentFileIds: ['first', 'second'] },
      {},
      false
    ])
  })

  it('includes the examined report context in suggestion requests', async () => {
    vi.mocked(API.setter).mockResolvedValueOnce({ ok: { type: 'expense' } })

    await requestReceiptSuggestion({
      type: 'expense',
      reportType: 'ExpenseReport',
      projectId: 'project',
      documentFileIds: ['receipt'],
      reportId: 'report',
      sourceReportType: 'ExpenseReport',
      endpointPrefix: 'examine/'
    })

    expect(vi.mocked(API.setter).mock.calls.at(-1)?.[1]).toEqual({
      type: 'expense',
      reportType: 'ExpenseReport',
      projectId: 'project',
      documentFileIds: ['receipt'],
      reportId: 'report',
      sourceReportType: 'ExpenseReport'
    })
  })

  it('lets the form expose a failed suggestion request', async () => {
    const error = new Error('suggestion failed')
    vi.mocked(API.setter).mockResolvedValueOnce({ error })

    await expect(
      requestReceiptSuggestion({
        type: 'expense',
        reportType: 'Travel',
        projectId: 'project',
        documentFileIds: ['receipt'],
        sourceReportType: 'Travel',
        endpointPrefix: ''
      })
    ).rejects.toBe(error)
  })

  it('fills only a pristine default cost and keeps positions with repeated VAT rates', () => {
    const cost = pristineCost()

    applySuggestedCost(
      cost,
      {
        date: '2026-07-24',
        currencyCode: 'USD',
        positions: [
          { description: 'Meal', grossAmount: 10.7, vatRate: 7, categoryId: category._id },
          { description: 'Drinks', grossAmount: 5.95, vatRate: 7, categoryId: drinksCategory._id }
        ]
      },
      {
        categories: [category, drinksCategory],
        currencies: [baseCurrency, usd],
        defaultProject: project,
        dirty: new Set(),
        reportType: 'Travel'
      }
    )

    expect(cost.date).toBe('2026-07-24')
    expect(cost.currency).toBe(usd)
    expect(cost.positions).toHaveLength(2)
    expect(cost.positions.map(({ vatRate }) => vatRate)).toEqual([7, 7])
    expect(cost.positions.map(({ category: positionCategory }) => positionCategory)).toEqual([category, drinksCategory])
    expect(cost.positions.every((position) => position.project === project)).toBe(true)
  })

  it('does not overwrite fields changed by the user', () => {
    const cost = pristineCost()
    const originalPositions = cost.positions

    applySuggestedCost(
      cost,
      { date: '2026-07-24', currencyCode: 'USD', positions: [{ grossAmount: 42, vatRate: 19, categoryId: category._id }] },
      {
        categories: [category],
        currencies: [baseCurrency, usd],
        defaultProject: project,
        dirty: new Set(['currency', 'date', 'positions']),
        reportType: 'Travel'
      }
    )

    expect(cost.date).toBe('')
    expect(cost.currency).toBe(baseCurrency)
    expect(cost.positions).toBe(originalPositions)
  })

  it('only maps suggested places with a known country', () => {
    const germany = {
      _id: 'DE',
      name: { de: 'Deutschland', en: 'Germany', fr: 'Allemagne', es: 'Alemania', ru: 'Германия', kk: 'Германия' },
      lumpSums: []
    }

    expect(suggestedPlace({ place: 'Berlin', countryCode: 'DE' }, [germany])).toEqual({ place: 'Berlin', country: germany })
    expect(suggestedPlace({ place: 'Unknown', countryCode: 'XX' }, [germany])).toBeUndefined()
  })
})
