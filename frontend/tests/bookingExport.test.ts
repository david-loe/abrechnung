import type { BookingExportRow } from 'abrechnung-common/types.js'
import { describe, expect, it } from 'vitest'
import { bookingExportToCSV } from '../src/bookingCsv.js'

describe('bookingExportToCSV', () => {
  it('creates an Excel-compatible CSV with report context and escaped cells', () => {
    const row: BookingExportRow<string> = {
      _id: 'booking',
      ledgerAccount: { _id: 'account', identifier: '4900', name: 'Other; costs' },
      amount: 12.5,
      date: '2026-07-27T12:00:00.000Z',
      project: { _id: 'project', identifier: 'P-1', organisation: 'organisation' },
      remark: 'Line 1\n"Line 2"',
      report: { _id: 'report', name: 'July expenses', reference: 32 },
      reportType: 'ExpenseReport',
      employee: { _id: 'employee', employeeId: 'E-1', name: { givenName: 'Test', familyName: 'User' } }
    }

    const csv = bookingExportToCSV([row], (key) => key)

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('2026-07-27;labels.expenseReport;E-010')
    expect(csv).toContain('P-1;4900;"Other; costs";12.5;"Line 1\n""Line 2"""')
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})
