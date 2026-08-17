import { type ReportModelName, TravelState, type User } from 'abrechnung-common/types.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api.js', () => ({ default: { getter: vi.fn() } }))

import API from '@/api.js'
import { getReportReferenceUrl, getRouteForReportReference } from '@/helper.js'

const owner = { _id: 'owner' } as User
const meta = { count: 1, page: 1, limit: 1, countPages: 1 }

afterEach(() => vi.clearAllMocks())

describe('report reference links', () => {
  it.each([
    ['Travel', 'T-001', '/travel/report-id'],
    ['ExpenseReport', 'E-001', '/expenseReport/report-id'],
    ['HealthCareCost', 'H-001', '/healthCareCost/report-id'],
    ['Advance', 'A-001', '/advance/report-id']
  ] as [ReportModelName, string, string][])('builds and resolves %s references', async (reportModelName, reference, expectedRoute) => {
    vi.mocked(API.getter).mockResolvedValue({
      ok: { data: { _id: 'report-id', owner: 'owner', state: TravelState.APPLIED_FOR }, meta }
    } as never)

    expect(getReportReferenceUrl(1, reportModelName)).toBe(`http://frontend.test/${reference}`)
    await expect(getRouteForReportReference(owner, reference)).resolves.toBe(expectedRoute)
    expect(API.getter).toHaveBeenCalledWith('search/ref', { ref: 1, type: reportModelName })
  })

  it('uses the existing permission-aware route selection', async () => {
    const examiner = { _id: 'examiner', access: { 'examine/travel': true } } as unknown as User
    vi.mocked(API.getter).mockResolvedValue({
      ok: { data: { _id: 'report-id', owner: 'owner', state: TravelState.APPROVED }, meta }
    } as never)

    await expect(getRouteForReportReference(examiner, 'T-001')).resolves.toBe('/examine/travel/report-id')
  })

  it('does not request malformed references', async () => {
    await expect(getRouteForReportReference(owner, 'not-a-reference')).resolves.toBeUndefined()
    expect(API.getter).not.toHaveBeenCalled()
  })

  it('returns no route when the report cannot be accessed', async () => {
    vi.mocked(API.getter).mockResolvedValue({ error: new Error('Not found') })

    await expect(getRouteForReportReference(owner, 'T-001')).resolves.toBeUndefined()
  })
})
