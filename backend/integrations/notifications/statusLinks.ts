import { type _id, type AnyState, type ReportType, State } from 'abrechnung-common/types.js'

export function getOwnerReportRoute(reportType: ReportType, reportId: _id, state: AnyState) {
  if (state === State.REJECTED) {
    if (reportType === 'travel') return `/user/travel/${reportId}`
    if (reportType === 'advance') return `/advance/${reportId}`
    return `/${reportType}`
  }

  return `/${reportType}/${reportId}`
}
