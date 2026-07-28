import { type BookingExportRow, getReportTypeFromModelName } from 'abrechnung-common/types.js'
import { datetimeToDateString, download, refNumberToString, rowsToCSV } from 'abrechnung-common/utils/scripts.js'
import { formatter } from '@/formatter.js'

type Translate = (key: string) => string

export function bookingExportToCSV(rows: BookingExportRow<string>[], t: Translate) {
  return rowsToCSV([
    [
      t('labels.date'),
      t('labels.reportType'),
      t('csv.reference'),
      `${t('labels.report')} - ${t('labels.name')}`,
      t('labels.employeeId'),
      t('labels.applicant'),
      t('csv.projectIdentifier'),
      'Debit/Credit',
      t('labels.ledgerAccount'),
      `${t('labels.ledgerAccount')} - ${t('labels.name')}`,
      t('labels.amount'),
      t('labels.remark')
    ],
    ...rows.map((row) => [
      datetimeToDateString(row.date),
      t(`labels.${getReportTypeFromModelName(row.reportType)}`),
      refNumberToString(row.report.reference, row.reportType),
      row.report.name,
      row.employee.employeeId,
      formatter.name(row.employee.name),
      row.project.identifier,
      row.side,
      row.ledgerAccount.identifier,
      row.ledgerAccount.name,
      row.amount,
      row.remark
    ])
  ])
}

export function downloadBookingExport(rows: BookingExportRow<string>[], t: Translate) {
  download(new File([bookingExportToCSV(rows, t)], 'bookings.csv', { type: 'text/csv;charset=utf-8' }))
}
