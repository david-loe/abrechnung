import type { ExpenseReport } from 'abrechnung-common/types.js'
import { describe, expect, it } from 'vitest'
import { reportToCSV } from '../src/reportExport.js'

describe('reportToCSV', () => {
  it('keeps foreign expense rows unconverted and adds an EUR summary', () => {
    const currency = { _id: 'USD' }
    const project = { _id: 'project', identifier: 'P-1', name: 'Project', organisation: 'organisation' }
    const report = {
      _id: 'report',
      name: 'Foreign expenses',
      reference: 1,
      owner: { name: { givenName: 'Test', familyName: 'User' } },
      project,
      currency,
      exchangeRateDate: '2026-08-16T00:00:00.000Z',
      exchangeRate: 0.9,
      expenses: [
        {
          _id: 'expense',
          description: 'Taxi',
          cost: {
            currency,
            date: '2026-08-16T00:00:00.000Z',
            receipts: [],
            positions: [
              {
                _id: 'position',
                kind: 'manual',
                description: 'Ride',
                grossAmount: 100.02,
                vatRate: 0,
                project,
                category: { _id: 'category', name: 'Travel' }
              }
            ]
          }
        }
      ],
      advances: [],
      addUp: [
        {
          project,
          currency,
          expenses: { amount: 100.02 },
          advance: { amount: 40 },
          total: { amount: 100.02 },
          balance: { amount: 60.02 },
          advanceOverflow: false,
          negativeTotal: false
        }
      ]
    } as unknown as ExpenseReport<string>

    const csv = reportToCSV(report, [], 'en', (key) => key)

    expect(csv).toContain('Taxi;Ride;2026-08-16;100.02;100.02;0;0;USD;;;;P-1;Travel;')
    expect(csv).toContain('csv.sections.summary')
    expect(csv).toContain('P-1;100.02;40;60.02;USD;54.02')
  })
})
