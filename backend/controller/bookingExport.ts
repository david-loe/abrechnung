import { BookingExportRow, IdDocument, idDocumentToId, ReportModelName, State } from 'abrechnung-common/types.js'
import { Model, Types } from 'mongoose'
import { NotFoundError } from './error.js'
import { AuthenticatedExpressRequest } from './types.js'

interface ExportReport {
  _id: Types.ObjectId
  name: string
  reference: number
  owner: BookingExportRow<Types.ObjectId>['employee']
  bookings: Omit<BookingExportRow<Types.ObjectId>, 'report' | 'reportType' | 'employee'>[]
}

export async function getBookingExportRows(
  // biome-ignore lint/suspicious/noExplicitAny: shared helper accepts each concrete report model
  reportModel: Model<any>,
  reportType: ReportModelName,
  requestedReports: IdDocument<string>[],
  request: AuthenticatedExpressRequest
) {
  const requestedIds = Array.from(new Set(requestedReports.map((report) => idDocumentToId(report).toString())))
  if (requestedIds.length === 0) {
    return []
  }

  const filter = { _id: { $in: requestedIds }, historic: false, state: State.BOOKABLE } as Record<string, unknown>
  if (request.user.projects.supervised.length > 0) {
    filter.project = { $in: request.user.projects.supervised }
  }

  const reports = (await reportModel.find(filter, { name: 1, reference: 1, owner: 1, bookings: 1 }).lean()) as ExportReport[]
  if (reports.length !== requestedIds.length) {
    throw new NotFoundError('At least one selected report was not found, is not bookable, or is not allowed')
  }
  await reportModel.populate(reports, { path: 'owner', select: { name: 1, employeeId: 1 } })

  const reportsById = new Map(reports.map((report) => [report._id.toString(), report]))
  return requestedIds.flatMap((reportId) => {
    const report = reportsById.get(reportId)
    if (!report) {
      return []
    }
    return report.bookings.map(
      (booking): BookingExportRow<Types.ObjectId> => ({
        ...booking,
        report: { _id: report._id, name: report.name, reference: report.reference },
        reportType,
        employee: report.owner
      })
    )
  })
}
