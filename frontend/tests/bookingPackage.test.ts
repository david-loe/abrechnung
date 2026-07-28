import type { BookingExportPackage } from 'abrechnung-common/types.js'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, test } from 'vitest'
import { createBookingPackageArchive } from '../src/bookingPackage.js'

describe('booking package', () => {
  test('contains localized CSV and one safely named XML file per organisation', () => {
    const value: BookingExportPackage<string> = {
      bookings: [
        {
          _id: 'booking',
          side: 'debit',
          ledgerAccount: { _id: 'ledger', identifier: '4900', name: 'Expense' },
          amount: 12.34,
          date: '2026-08-01',
          project: { _id: 'project', identifier: '001', organisation: 'organisation' },
          report: { _id: 'report', name: 'Report', reference: 1 },
          reportType: 'ExpenseReport',
          employee: { _id: 'employee', name: { givenName: 'Philip', familyName: 'Fry' }, employeeId: 'E-1' }
        }
      ],
      sepaFiles: [{ organisation: { name: 'Planet/Express' }, account: { lastFour: '3000' }, xml: '<Document />' }]
    }
    const files = unzipSync(createBookingPackageArchive(value, '2026-08-01', (key) => `translated:${key}`))
    expect(Object.keys(files).sort()).toEqual(['Planet_Express-2026-08-01-3000.xml', 'bookings.csv'])
    expect(strFromU8(files['bookings.csv'])).toContain('translated:labels.date')
    expect(strFromU8(files['Planet_Express-2026-08-01-3000.xml'])).toBe('<Document />')
  })
})
