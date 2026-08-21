import { AdvanceState, type ReportModelName, State, TravelState, type User } from 'abrechnung-common/types.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api.js', () => ({ default: { getter: vi.fn() } }))

import API from '@/api.js'
import { getReportReferenceUrl, getRouteForReport, getRouteForReportReference } from '@/helper.js'

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

  it.each([
    ['Travel', '/admin/report/travel/report-id'],
    ['ExpenseReport', '/admin/report/expenseReport/report-id'],
    ['HealthCareCost', '/admin/report/healthCareCost/report-id'],
    ['Advance', '/admin/report/advance/report-id']
  ] as [ReportModelName, string][])(
    'routes an admin without report permissions to the read-only %s view',
    (reportModelName, expectedRoute) => {
      const admin = { _id: 'admin', access: { admin: true } } as unknown as User
      const report = { _id: 'report-id', owner: 'owner', state: TravelState.APPLIED_FOR }

      expect(getRouteForReport(admin, report, reportModelName)).toBe(expectedRoute)
    }
  )

  it('keeps owner access ahead of the additional admin read access', () => {
    const adminOwner = { _id: 'owner', access: { admin: true } } as unknown as User
    const report = { _id: 'report-id', owner: 'owner', state: TravelState.APPLIED_FOR }

    expect(getRouteForReport(adminOwner, report, 'Travel')).toBe('/travel/report-id')
  })

  it.each([
    ['Travel', TravelState.APPROVED, { 'examine/travel': true }, '/examine/travel/report-id'],
    ['Travel', TravelState.APPLIED_FOR, { 'approve/travel': true }, '/approve/travel/report-id'],
    ['ExpenseReport', State.EDITABLE_BY_OWNER, { 'examine/expenseReport': true }, '/examine/expenseReport/report-id'],
    ['HealthCareCost', State.EDITABLE_BY_OWNER, { 'examine/healthCareCost': true }, '/examine/healthCareCost/report-id'],
    ['Advance', AdvanceState.APPLIED_FOR, { 'approve/advance': true }, '/approve/advance/report-id']
  ] as const)('keeps explicit workflow access ahead of the admin view for %s', (reportModelName, state, workflowAccess, expectedRoute) => {
    const admin = { _id: 'admin', access: { admin: true, ...workflowAccess } } as unknown as User
    const report = { _id: 'report-id', owner: 'owner', state }

    expect(getRouteForReport(admin, report, reportModelName)).toBe(expectedRoute)
  })

  it.each([
    ['Travel', TravelState.REJECTED, { 'approve/travel': true }, '/admin/report/travel/report-id'],
    ['Advance', AdvanceState.REJECTED, { 'approve/advance': true }, '/admin/report/advance/report-id']
  ] as const)('routes a rejected %s to the admin view instead of approval', (reportModelName, state, workflowAccess, expectedRoute) => {
    const admin = { _id: 'admin', access: { admin: true, ...workflowAccess } } as unknown as User
    const report = { _id: 'report-id', owner: 'owner', state }

    expect(getRouteForReport(admin, report, reportModelName)).toBe(expectedRoute)
  })

  it.each([
    ['Travel', TravelState.REVIEW_COMPLETED, { 'book/travel': true }, '/admin/report/travel/report-id'],
    ['ExpenseReport', State.BOOKABLE, { 'book/expenseReport': true }, '/admin/report/expenseReport/report-id'],
    ['HealthCareCost', State.BOOKABLE, { 'book/healthCareCost': true }, '/admin/report/healthCareCost/report-id'],
    ['Advance', AdvanceState.APPROVED, { 'book/advance': true }, '/admin/report/advance/report-id']
  ] as const)('keeps the admin view ahead of booking for %s', (reportModelName, state, bookingAccess, expectedRoute) => {
    const admin = { _id: 'admin', access: { admin: true, ...bookingAccess } } as unknown as User
    const report = { _id: 'report-id', owner: 'owner', state }

    expect(getRouteForReport(admin, report, reportModelName)).toBe(expectedRoute)
  })

  it.each([
    ['Travel', TravelState.REVIEW_COMPLETED, { 'book/travel': true }, '/book/travel/report-id'],
    ['ExpenseReport', State.BOOKABLE, { 'book/expenseReport': true }, '/book/expenseReport/report-id'],
    ['HealthCareCost', State.BOOKABLE, { 'book/healthCareCost': true }, '/book/healthCareCost/report-id'],
    ['Advance', AdvanceState.APPROVED, { 'book/advance': true }, '/book/advance/report-id']
  ] as const)('keeps the booking route for a non-admin %s booker', (reportModelName, state, bookingAccess, expectedRoute) => {
    const booker = { _id: 'booker', access: bookingAccess } as unknown as User
    const report = { _id: 'report-id', owner: 'owner', state }

    expect(getRouteForReport(booker, report, reportModelName)).toBe(expectedRoute)
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
