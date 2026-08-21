import { describe, expect, it } from 'vitest'
import {
  advanceImportTemplateFields,
  expenseReportImportTemplateFields,
  parseCsvBoolean,
  parseCsvNumber,
  travelImportTemplateFields
} from '@/csvImport.js'

describe('CSV import value parsing', () => {
  it('exposes templates for all report creation fields', () => {
    expect(advanceImportTemplateFields).toEqual([
      'owner',
      'name',
      'reason',
      'budget.amount',
      'budget.currency',
      'exchangeRateDate',
      'project',
      'comment',
      'bookingRemark'
    ])
    expect(travelImportTemplateFields).toContain('destinationPlace.country')
    expect(travelImportTemplateFields).toContain('a1Certificate.exactAddress')
    expect(travelImportTemplateFields).toContain('advances')
    expect(expenseReportImportTemplateFields).toEqual(['owner', 'name', 'project', 'currency', 'advances'])
  })

  it('parses decimal point and decimal comma numbers', () => {
    expect(parseCsvNumber('12.50')).toBe(12.5)
    expect(parseCsvNumber('12,50')).toBe(12.5)
    expect(parseCsvNumber('')).toBeUndefined()
    expect(() => parseCsvNumber('twelve')).toThrow("Invalid number: 'twelve'")
  })

  it('parses explicit boolean values', () => {
    expect(parseCsvBoolean('true')).toBe(true)
    expect(parseCsvBoolean('1')).toBe(true)
    expect(parseCsvBoolean('FALSE')).toBe(false)
    expect(parseCsvBoolean('0')).toBe(false)
    expect(parseCsvBoolean('')).toBeUndefined()
    expect(() => parseCsvBoolean('yes')).toThrow('Use true/false or 1/0')
  })
})
