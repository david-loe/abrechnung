import { AdvanceSimple } from 'abrechnung-common/types.js'
import { describe, expect, it } from 'vitest'
import { filterAdvancesByCurrency } from '@/components/advance/scripts.js'

const eurAdvance = { _id: 'eur', budget: { currency: { _id: 'EUR' } } } as AdvanceSimple<string>
const usdAdvance = { _id: 'usd', budget: { currency: { _id: 'USD' } } } as AdvanceSimple<string>
const advances = [eurAdvance, usdAdvance]

describe('advance selector currency filtering', () => {
  it('keeps only advances matching the report currency', () => {
    expect(filterAdvancesByCurrency(advances, { _id: 'USD' })).toEqual([usdAdvance])
  })

  it('keeps all advances when the report uses its normal multi-currency mode', () => {
    expect(filterAdvancesByCurrency(advances)).toEqual(advances)
  })
})
