import {
  type Cost,
  type CostPosition,
  type CountrySimple,
  type Expense,
  type ExpenseReport,
  type HealthCareCost,
  idDocumentToId,
  type Locale,
  type OrganisationWithVatSettings,
  type Place,
  type ProjectSimple,
  reportIsHealthCareCost,
  reportIsTravel,
  type Stage,
  type Travel,
  type TravelDay
} from 'abrechnung-common/types.js'
import {
  datetimeToDateString,
  datetimeToDatetimeString,
  download,
  getCostPositionBaseCurrencyAmount,
  getCostPositionNetAmount,
  getCostPositionVatAmount,
  getEffectiveCostPositionVatRate,
  refNumberToString,
  rowsToCSV,
  sanitizeFilename
} from 'abrechnung-common/utils/scripts.js'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'

type CsvCell = string | number | null | undefined
type CsvRow = CsvCell[]
type ExportReport = Travel<string> | ExpenseReport<string> | HealthCareCost<string>
type Translate = (key: string) => string

function countryName(country: CountrySimple | undefined, locale: Locale) {
  return country?.name[locale] || country?._id || ''
}

function date(value: Date | string | null | undefined) {
  return value ? datetimeToDateString(value) : ''
}

function timestamp(value: Date | string | null | undefined) {
  return value ? datetimeToDatetimeString(value) : ''
}

function boolean(value: boolean | null | undefined, t: Translate) {
  return value === undefined || value === null ? '' : t(value ? 'csv.yes' : 'csv.no')
}

function projectIdentifier(project: ProjectSimple<string> | null | undefined) {
  return project?.identifier || ''
}

function vatAccountingEnabled(position: CostPosition<string>, organisations: OrganisationWithVatSettings<string>[]) {
  const organisationId = idDocumentToId(position.project.organisation).toString()
  return Boolean(organisations.find(({ _id }) => _id === organisationId)?.accountingSettings.vatAccountingEnabled)
}

function costCells(cost: Cost<string>, position: CostPosition<string>, organisations: OrganisationWithVatSettings<string>[]): CsvCell[] {
  const vatEnabled = vatAccountingEnabled(position, organisations)
  return [
    position.grossAmount,
    getCostPositionNetAmount(position, vatEnabled),
    getCostPositionVatAmount(position, vatEnabled),
    getEffectiveCostPositionVatRate(position, vatEnabled),
    cost.currency._id,
    date(cost.exchangeRate?.date),
    cost.exchangeRate?.rate,
    getCostPositionBaseCurrencyAmount(cost, position)
  ]
}

function addSection(rows: CsvRow[], title: string, content: CsvRow[]) {
  if (rows.length > 0) {
    rows.push([])
  }
  rows.push([title], ...content)
}

function projectDetailRows(report: ExportReport, t: Translate): CsvRow[] {
  return [
    [
      t('csv.reference'),
      refNumberToString(
        report.reference,
        reportIsTravel(report) ? 'Travel' : reportIsHealthCareCost(report) ? 'HealthCareCost' : 'ExpenseReport'
      )
    ],
    [t('labels.name'), report.name],
    [t('labels.applicant'), formatter.name(report.owner.name)],
    [t('csv.projectIdentifier'), report.project.identifier],
    [t('csv.projectName'), report.project.name]
  ]
}

function placeDetailRows(prefix: string, place: Omit<Place, 'place'> | Place | null | undefined, locale: Locale, t: Translate): CsvRow[] {
  if (!place) {
    return [
      [t(`csv.${prefix}Country`), ''],
      [t(`csv.${prefix}Special`), '']
    ]
  }

  const rows: CsvRow[] = []
  if ('place' in place) {
    rows.push([t(`csv.${prefix}Place`), place.place])
  }
  rows.push([t(`csv.${prefix}Country`), countryName(place.country, locale)], [t(`csv.${prefix}Special`), place.special])
  return rows
}

function expenseRows(
  expenses: Expense<string>[],
  organisations: OrganisationWithVatSettings<string>[],
  t: Translate,
  includePurpose = false
) {
  const headers = [
    t('labels.description'),
    t('labels.position'),
    t('labels.invoiceDate'),
    t('csv.originalAmount'),
    t('labels.netAmount'),
    t('labels.vatAmount'),
    t('labels.vatRate'),
    t('labels.currency'),
    t('csv.exchangeRateDate'),
    t('csv.exchangeRate'),
    t('csv.euroAmount'),
    t('csv.differentProject'),
    t('labels.category'),
    t('labels.note')
  ]
  if (includePurpose) {
    headers.splice(1, 0, t('labels.purpose'))
  }

  return [
    headers,
    ...expenses.flatMap((expense) =>
      expense.cost.positions.map((position) => {
        const row: CsvRow = [
          expense.description,
          position.kind === 'ownCar' ? t('labels.ownCar') : position.description,
          date(expense.cost.date),
          ...costCells(expense.cost, position, organisations),
          projectIdentifier(position.project),
          position.category.name,
          expense.note
        ]
        if (includePurpose && 'purpose' in expense) {
          row.splice(1, 0, t(`labels.${expense.purpose}`))
        }
        return row
      })
    )
  ]
}

function midnightCountries(stage: Stage<string>, locale: Locale) {
  return stage.midnightCountries?.map((entry) => `${date(entry.date)}: ${countryName(entry.country, locale)}`).join(', ') || ''
}

function stageRows(stages: Stage<string>[], organisations: OrganisationWithVatSettings<string>[], locale: Locale, t: Translate): CsvRow[] {
  return [
    [
      t('labels.departure'),
      t('labels.arrival'),
      t('csv.startPlace'),
      t('csv.startCountry'),
      t('csv.startSpecial'),
      t('csv.endPlace'),
      t('csv.endCountry'),
      t('csv.endSpecial'),
      t('labels.midnightCountries'),
      t('labels.transport'),
      t('labels.distanceRefundType'),
      t('labels.distance'),
      t('labels.purpose'),
      t('labels.position'),
      t('csv.originalAmount'),
      t('labels.netAmount'),
      t('labels.vatAmount'),
      t('labels.vatRate'),
      t('labels.currency'),
      t('csv.exchangeRateDate'),
      t('csv.exchangeRate'),
      t('csv.euroAmount'),
      t('csv.differentProject'),
      t('labels.category'),
      t('labels.note')
    ],
    ...stages.flatMap((stage) =>
      (stage.cost.positions.length ? stage.cost.positions : [undefined]).map((position) => [
        timestamp(stage.departure),
        timestamp(stage.arrival),
        stage.startLocation.place,
        countryName(stage.startLocation.country, locale),
        stage.startLocation.special,
        stage.endLocation.place,
        countryName(stage.endLocation.country, locale),
        stage.endLocation.special,
        midnightCountries(stage, locale),
        t(`labels.${stage.transport.type}`),
        stage.transport.type === 'ownCar' ? t(`distanceRefundTypes.${stage.transport.distanceRefundType}`) : '',
        stage.transport.type === 'ownCar' ? stage.transport.distance : '',
        t(`labels.${stage.purpose}`),
        position ? (position.kind === 'ownCar' ? t('labels.ownCar') : position.description) : '',
        ...(position ? costCells(stage.cost, position, organisations) : ['', '', '', '', stage.cost.currency?._id, '', '', '']),
        projectIdentifier(position?.project),
        position?.category.name,
        stage.note
      ])
    )
  ]
}

function lumpSumRows(days: TravelDay<string>[], locale: Locale, t: Translate): CsvRow[] {
  return [
    [
      t('labels.date'),
      t('labels.country'),
      t('labels.place'),
      t('labels.purpose'),
      t('labels.breakfast'),
      t('labels.lunch'),
      t('labels.dinner'),
      t('labels.overnight'),
      t('csv.cateringAmount'),
      t('csv.overnightAmount')
    ],
    ...days.map((day) => [
      date(day.date),
      countryName(day.country, locale),
      day.special,
      t(`labels.${day.purpose}`),
      boolean(day.cateringRefund.breakfast, t),
      boolean(day.cateringRefund.lunch, t),
      boolean(day.cateringRefund.dinner, t),
      boolean(day.overnightRefund, t),
      day.lumpSums.catering.refund.amount,
      day.lumpSums.overnight.refund.amount
    ])
  ]
}

export function reportToCSV(report: ExportReport, organisations: OrganisationWithVatSettings<string>[], locale: Locale, t: Translate) {
  const rows: CsvRow[] = []
  const details = projectDetailRows(report, t)

  if (reportIsTravel(report)) {
    details.push(
      [t('labels.reason'), report.reason],
      ...placeDetailRows('destination', report.destinationPlace, locale, t),
      [t('labels.startDate'), date(report.startDate)],
      [t('labels.endDate'), date(report.endDate)],
      [t('labels.claimSpouseRefund'), boolean(report.claimSpouseRefund, t)],
      [t('labels.fellowTravelersNames'), report.fellowTravelersNames],
      [t('labels.isCrossBorder'), boolean(report.isCrossBorder, t)],
      [t('labels.a1Certificate'), boolean(Boolean(report.a1Certificate), t)],
      [t('labels.destinationName'), report.a1Certificate?.destinationName],
      [t('labels.exactAddress'), report.a1Certificate?.exactAddress],
      [t('labels.professionalShare'), report.professionalShare],
      ...placeDetailRows('lastPlaceOfWork', report.lastPlaceOfWork, locale, t)
    )
  } else if (reportIsHealthCareCost(report)) {
    details.push(
      [t('labels.patientName'), report.patientName],
      [`${t('labels.insurance')} - ${t('labels.name')}`, report.insurance.name],
      [`${t('labels.insurance')} - ${t('labels.email')}`, report.insurance.email]
    )
  }

  addSection(rows, t('csv.sections.details'), details)
  addSection(rows, t('csv.sections.expenses'), expenseRows(report.expenses, organisations, t, reportIsTravel(report)))

  if (reportIsTravel(report)) {
    addSection(rows, t('csv.sections.stages'), stageRows(report.stages, organisations, locale, t))
    addSection(rows, t('csv.sections.lumpSums'), lumpSumRows(report.days, locale, t))
  }

  return rowsToCSV(rows)
}

export function downloadReportCSV(report: ExportReport, locale: Locale, t: Translate) {
  const modelName = reportIsTravel(report) ? 'Travel' : reportIsHealthCareCost(report) ? 'HealthCareCost' : 'ExpenseReport'
  const reportName =
    report.name.trim() ||
    `${t(`labels.${modelName === 'Travel' ? 'travel' : modelName === 'HealthCareCost' ? 'healthCareCost' : 'expenseReport'}`)}-${refNumberToString(report.reference, modelName)}`
  download(
    new File([reportToCSV(report, APP_LOADER.data.value?.organisations ?? [], locale, t)], `${sanitizeFilename(reportName)}.csv`, {
      type: 'text/csv;charset=utf-8'
    })
  )
}
