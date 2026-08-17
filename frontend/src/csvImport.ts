export const advanceImportTemplateFields = [
  'owner',
  'name',
  'reason',
  'budget.amount',
  'budget.currency',
  'project',
  'comment',
  'bookingRemark'
]

export const travelImportTemplateFields = [
  'owner',
  'name',
  'destinationPlace.place',
  'destinationPlace.country',
  'reason',
  'startDate',
  'endDate',
  'claimSpouseRefund',
  'fellowTravelersNames',
  'project',
  'advances',
  'isCrossBorder',
  'a1Certificate.exactAddress',
  'a1Certificate.destinationName'
]

export const expenseReportImportTemplateFields = ['owner', 'name', 'project', 'advances']

export function parseCsvNumber(value: string | undefined) {
  if (value === undefined || value.trim() === '') return undefined
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) throw new Error(`Invalid number: '${value}'`)
  return parsed
}

export function parseCsvBoolean(value: string | undefined) {
  if (value === undefined || value.trim() === '') return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  throw new Error(`Invalid boolean: '${value}'. Use true/false or 1/0.`)
}
