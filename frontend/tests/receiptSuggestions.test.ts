import { baseCurrency, Category, Cost, Currency, ProjectSimple } from 'abrechnung-common/types.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/api.js', () => ({ default: { getter: vi.fn() } }))

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
  })

  it('passes suggestion parameters to the configured Axios query serializer', async () => {
    vi.mocked(API.getter).mockResolvedValueOnce({ ok: { data: { type: 'expense' }, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } })

    await requestReceiptSuggestion({
      type: 'expense',
      reportType: 'Travel',
      projectId: 'project',
      documentFileIds: ['first', 'second'],
      endpointPrefix: ''
    })

    expect(vi.mocked(API.getter).mock.calls[0][1]).toEqual({
      type: 'expense',
      reportType: 'Travel',
      projectId: 'project',
      documentFileIds: ['first', 'second']
    })
  })

  it('fills only a pristine default cost and keeps distinct VAT positions', () => {
    const cost = pristineCost()

    applySuggestedCost(
      cost,
      {
        date: '2026-07-24',
        currencyCode: 'USD',
        positions: [
          { description: 'Meal', grossAmount: 10.7, vatRate: 7, categoryId: category._id },
          { description: 'Drinks', grossAmount: 5.95, vatRate: 19, categoryId: category._id }
        ]
      },
      { categories: [category], currencies: [baseCurrency, usd], defaultProject: project, dirty: new Set(), reportType: 'Travel' }
    )

    expect(cost.date).toBe('2026-07-24')
    expect(cost.currency).toBe(usd)
    expect(cost.positions).toHaveLength(2)
    expect(cost.positions.map(({ vatRate }) => vatRate)).toEqual([7, 19])
    expect(cost.positions.every((position) => position.project === project && position.category === category)).toBe(true)
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
