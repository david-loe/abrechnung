import { TextAlignment } from 'pdf-lib'
import {
  _id,
  Advance,
  AdvanceState,
  AnyState,
  baseCurrency,
  Comment,
  Cost,
  CountrySimple,
  ExpenseReport,
  getModelNameFromReport,
  getReportTypeFromModelName,
  HealthCareCost,
  Locale,
  Meal,
  Place,
  PrinterSettings,
  PrintOptions,
  Purpose,
  PurposeSimple,
  ReportModelNameWithoutAdvance,
  reportIsAdvance,
  reportIsExpenseReport,
  reportIsHealthCareCost,
  reportIsTravel,
  State,
  Transport,
  Travel,
  TravelDay,
  TravelExpense,
  TravelSettings,
  TravelState,
  UserSimple
} from '../types.js'
import Formatter from '../utils/formatter.js'
import { getAddUpTableData, getTotalBalance, isValidDate, refNumberToString } from '../utils/scripts.js'
import { Column, EMPTY_CELL, Options, PDFDrawer, Printer, ReceiptMap, TableOptions } from './printer.js'

function getReceiptMap<idType extends _id>(costList: { cost: Cost<idType> }[], startNumber = 1) {
  let number = startNumber
  const map: ReceiptMap<idType> = {}
  for (const cost of costList) {
    if (cost.cost?.receipts) {
      for (const receipt of cost.cost.receipts) {
        map[receipt._id.toString()] = Object.assign({ number: number++, date: cost.cost.date as Date }, receipt)
      }
    }
  }
  return { map, number }
}

interface ReportPrinterTravelSettings {
  distanceRefunds: TravelSettings['distanceRefunds']
  vehicleRegistrationWhenUsingOwnCar: TravelSettings['vehicleRegistrationWhenUsingOwnCar']
}

export class ReportPrinter<idType extends _id> extends Printer<idType> {
  travelSettings: ReportPrinterTravelSettings

  constructor(
    settings: PrinterSettings,
    travelSettings: ReportPrinterTravelSettings,
    formatter: Formatter,
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string,
    getDocumentFileBufferById: PDFDrawer<idType>['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer<idType>['getOrganisationLogoIdById']
  ) {
    super(settings, formatter, translateFunc, getDocumentFileBufferById, getOrganisationLogoIdById)
    this.travelSettings = travelSettings
  }

  async print(
    report: Travel<idType> | ExpenseReport<idType> | HealthCareCost<idType> | Advance<idType>,
    language: Locale,
    options?: Partial<PrintOptions>
  ) {
    const print = await ReportPrint.create(
      report,
      this.settings,
      this.getDocumentFileBufferById,
      this.getOrganisationLogoIdById,
      this.travelSettings,
      this.formatter,
      this.translateFunc,
      language
    )
    return await print.run(options)
  }

  setTravelSettings(settings: ReportPrinterTravelSettings) {
    this.travelSettings = settings
  }
}

class ReportPrint<idType extends _id> {
  drawer: PDFDrawer<idType>
  report: Travel<idType> | ExpenseReport<idType> | HealthCareCost<idType> | Advance<idType>
  travelSettings: ReportPrinterTravelSettings
  translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string

  constructor(
    report: Travel<idType> | ExpenseReport<idType> | HealthCareCost<idType> | Advance<idType>,
    drawer: PDFDrawer<idType>,
    travelSettings: ReportPrinterTravelSettings,
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string
  ) {
    this.report = report
    this.drawer = drawer
    this.travelSettings = travelSettings
    this.translateFunc = translateFunc
  }

  static async create<idType extends _id>(
    report: Travel<idType> | ExpenseReport<idType> | HealthCareCost<idType> | Advance<idType>,
    settings: PrinterSettings,
    getDocumentFileBufferById: PDFDrawer<idType>['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer<idType>['getOrganisationLogoIdById'],
    travelSettings: ReportPrinterTravelSettings,
    formatter: Formatter,
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string,
    language: Locale
  ) {
    const drawer = await PDFDrawer.create(settings, getDocumentFileBufferById, getOrganisationLogoIdById, formatter, language, 'landscape')
    return new ReportPrint<idType>(report, drawer, travelSettings, translateFunc)
  }

  async run(options?: Partial<PrintOptions>) {
    const modelName = getModelNameFromReport(this.report)

    const opts = { ...this.drawer.settings.options[getReportTypeFromModelName(modelName)], ...options }
    let y = this.drawer.currentPage.getSize().height

    await this.drawer.drawLogo(this.t('headlines.title'), {
      fontSize: this.drawer.settings.fontSizes.L,
      xStart: this.drawer.settings.pagePadding / 3,
      yStart: y - this.drawer.settings.pagePadding / 3
    })

    if (this.report.reference > 0) {
      await this.drawer.drawMultilineText(refNumberToString(this.report.reference, modelName), {
        alignment: TextAlignment.Center,
        xStart: 0,
        yStart: y - this.drawer.settings.pagePadding / 5,
        width: this.drawer.currentPage.getSize().width,
        fontSize: this.drawer.settings.fontSizes.S
      })
    }

    await this.drawer.drawOrganisationLogo(this.report.project.organisation, {
      xStart: this.drawer.currentPage.getSize().width - 166,
      yStart: y - 66,
      maxHeight: 50,
      maxWidth: 150
    })
    y = y - this.drawer.settings.pagePadding

    y =
      this.drawNameAndProject(
        { xStart: this.drawer.settings.pagePadding, yStart: y - 24, fontSize: this.drawer.settings.fontSizes.M },
        opts.project
      ) - 10
    if (opts.metaInformation) {
      y = await this.drawTravelInformation({
        xStart: this.drawer.settings.pagePadding,
        yStart: y,
        fontSize: this.drawer.settings.fontSizes.M
      })
      y = this.drawExpenseInformation({ xStart: this.drawer.settings.pagePadding, yStart: y, fontSize: this.drawer.settings.fontSizes.M })
      y = this.drawHealthCareCostInformation({
        xStart: this.drawer.settings.pagePadding,
        yStart: y,
        fontSize: this.drawer.settings.fontSizes.M
      })
      y = this.drawAdvanceInformation({ xStart: this.drawer.settings.pagePadding, yStart: y, fontSize: this.drawer.settings.fontSizes.M })
    }

    const receiptMap = {}
    if (!reportIsAdvance(this.report)) {
      const optionalMapTravel = reportIsTravel(this.report)
        ? getReceiptMap(
            this.report.stages.filter(
              (s) => this.travelSettings.vehicleRegistrationWhenUsingOwnCar !== 'none' || s.transport.type !== 'ownCar'
            )
          )
        : { map: {}, number: 1 }

      Object.assign(receiptMap, optionalMapTravel.map, getReceiptMap(this.report.expenses, optionalMapTravel.number).map)
    }
    let yDates = y
    y = await this.drawSummary({ xStart: this.drawer.settings.pagePadding, yStart: y, fontSize: this.drawer.settings.fontSizes.M })

    if (opts.reviewDates) {
      yDates = await this.drawDates({
        xStart: this.drawer.currentPage.getSize().width - this.drawer.settings.pagePadding - 175, // 175: width of dates table
        yStart: yDates,
        fontSize: this.drawer.settings.fontSizes.S
      })
    }

    y = y < yDates ? y : yDates

    y = await this.drawStages(
      receiptMap,
      { xStart: this.drawer.settings.pagePadding, yStart: y - 16, fontSize: this.drawer.settings.fontSizes.S },
      opts.notes
    )
    y = await this.drawExpenses(
      receiptMap,
      { xStart: this.drawer.settings.pagePadding, yStart: y - 16, fontSize: this.drawer.settings.fontSizes.S },
      opts.notes
    )
    y = await this.drawDays({ xStart: this.drawer.settings.pagePadding, yStart: y - 16, fontSize: this.drawer.settings.fontSizes.S })
    y = await this.drawReports({ xStart: this.drawer.settings.pagePadding, yStart: y - 16, fontSize: this.drawer.settings.fontSizes.S })

    y = await this.drawComments(opts.comments, opts.bookingRemark, {
      xStart: this.drawer.settings.pagePadding,
      yStart: y - 16,
      fontSize: this.drawer.settings.fontSizes.S
    })

    await this.drawer.attachReceipts(receiptMap)

    return await this.drawer.finish()
  }

  drawNameAndProject(options: Options, drawProject = true) {
    let y = options.yStart
    y = this.drawer.drawMultilineText(this.report.name, { xStart: options.xStart, yStart: y, fontSize: options.fontSize * 1.5 })
    if (drawProject) {
      y = this.drawer.drawMultilineText(
        `${this.t('labels.project')}: ${this.report.project.identifier}${this.report.project.name ? ` - ${this.report.project.name}` : ''}`,
        { xStart: options.xStart, yStart: y, fontSize: options.fontSize }
      )
    }

    return y
  }

  async drawTravelInformation(options: Options) {
    let y = options.yStart
    if (reportIsTravel(this.report)) {
      // Traveler
      y = this.drawer.drawMultilineText(
        `${this.t('labels.traveler')}: ${this.drawer.formatter.name(this.report.owner.name)}${this.report.claimSpouseRefund ? ` & ${this.report.fellowTravelersNames}` : ''}`,
        { xStart: options.xStart, yStart: y, fontSize: options.fontSize }
      )

      // Reason + Place
      y = await this.drawer.drawMultilineTextWithPlace(
        `${this.t('labels.reason')}: ${this.report.reason}    ${this.t('labels.destinationPlace')}: `,
        this.report.destinationPlace,
        { xStart: options.xStart, yStart: y, fontSize: options.fontSize }
      )
      let text = ''
      // Dates + professionalShare + lastPlaceOfWork
      const sc = this.report.stages.length
      text = `${this.t('labels.from')}: ${sc > 0 ? this.drawer.formatter.dateTime(this.report.stages[0].departure) : this.drawer.formatter.date(this.report.startDate)}    ${this.t('labels.to')}: ${sc > 0 ? this.drawer.formatter.dateTime(this.report.stages[sc - 1].arrival) : this.drawer.formatter.date(this.report.endDate)}`

      if (this.report.professionalShare !== null && this.report.professionalShare !== 1) {
        text = `${text}    ${this.t('labels.professionalShare')}: ${Math.round(this.report.professionalShare * 100)}%`
      }
      if (this.report.lastPlaceOfWork) {
        const lastPlace = { country: this.report.lastPlaceOfWork.country, place: this.report.lastPlaceOfWork.special }
        y = await this.drawer.drawMultilineTextWithPlace(`${text}    ${this.t('labels.lastPlaceOfWork')}: `, lastPlace, {
          xStart: options.xStart,
          yStart: y,
          fontSize: options.fontSize
        })
      } else {
        y = this.drawer.drawMultilineText(text, { xStart: options.xStart, yStart: y, fontSize: options.fontSize })
      }
    }
    return y
  }

  drawExpenseInformation(options: Options) {
    let y = options.yStart
    if (reportIsExpenseReport(this.report)) {
      y = this.drawer.drawMultilineText(
        `${this.t('labels.expensePayer')}: ${this.drawer.formatter.name(this.report.owner.name)}    ${this.t('labels.category')}: ${this.report.category.name}`,
        { xStart: options.xStart, yStart: y, fontSize: options.fontSize }
      )

      if (this.report.expenses.length > 0) {
        // Dates
        const text = `${this.t('labels.from')}: ${this.drawer.formatter.date(this.report.expenses[0].cost.date)}    ${this.t('labels.to')}: ${this.drawer.formatter.date(this.report.expenses[this.report.expenses.length - 1].cost.date)}`
        y = this.drawer.drawMultilineText(text, { xStart: options.xStart, yStart: y, fontSize: options.fontSize })
      }
    }
    return y
  }

  drawHealthCareCostInformation(options: Options) {
    let y = options.yStart
    if (reportIsHealthCareCost(this.report)) {
      // Insurance + patientName
      y = this.drawer.drawMultilineText(
        `${this.t('labels.insurance')}: ${this.report.insurance.name}      ${this.t('labels.applicant')}: ${this.drawer.formatter.name(this.report.owner.name)}      ${this.t('labels.patientName')}: ${this.report.patientName}`,
        { xStart: options.xStart, yStart: y, fontSize: options.fontSize }
      )
    }
    return y
  }

  drawAdvanceInformation(options: Options) {
    let y = options.yStart
    if (reportIsAdvance(this.report)) {
      y = this.drawer.drawMultilineText(
        `${this.t('labels.advanceRecipient')}: ${this.drawer.formatter.name(this.report.owner.name)}      ${this.t('labels.reason')}: ${this.report.reason}`,
        { xStart: options.xStart, yStart: y, fontSize: options.fontSize }
      )
    }
    return y
  }

  async drawSummary(options: Options) {
    const columns: Column[] = []
    columns.push({ key: '0', width: 100, alignment: TextAlignment.Left, title: 'title', fn: (l: string) => this.t(l) })
    const moneyColumn = (key: string) => ({ key, width: 75, alignment: TextAlignment.Right, title: 'title' })
    let summary = []
    if (reportIsAdvance(this.report)) {
      columns.push(moneyColumn('1'))
      summary.push({ '0': this.t('labels.advance'), '1': this.drawer.formatter.money(this.report.budget) })
      summary.push({ '0': this.t('labels.balance'), '1': this.drawer.formatter.baseCurrency(this.report.balance.amount) })
    } else {
      for (let i = 0; i < this.report.addUp.length; i++) {
        columns.push(moneyColumn((i + 1).toString(10)))
      }
      const tableData = getAddUpTableData(this.drawer.formatter, this.report.addUp, reportIsTravel(this.report))
      summary = tableData.map((row) => Object.fromEntries(row.map((value, index) => [index.toString(10), value])))
    }
    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.summary'), { xStart: options.xStart, yStart: options.yStart - fontSize, fontSize: fontSize })
    const tableOptions: TableOptions = options
    tableOptions.yStart -= fontSize * 1.25
    tableOptions.firstRow = false
    let y = await this.drawer.drawTable(summary, columns, tableOptions)
    if (!reportIsAdvance(this.report) && this.report.addUp.length > 1) {
      options.yStart = y
      y = this.drawer.drawMultilineText(
        `${this.t('labels.totalBalance')}: ${this.drawer.formatter.baseCurrency(getTotalBalance(this.report.addUp))}`,
        options
      )
    }
    return y
  }

  async drawDates(options: Options) {
    const columns: Column[] = []
    columns.push({ key: 'reference', width: 80, alignment: TextAlignment.Left, title: 'reference' })
    columns.push({
      key: 'value',
      width: 95,
      alignment: TextAlignment.Left,
      title: 'value',
      fn: (d: Date | string) => {
        const validDate = isValidDate(d)
        return validDate ? this.drawer.formatter.date(validDate) : String(d)
      }
    })

    const summary = []
    if (reportIsAdvance(this.report)) {
      if (this.report.log[AdvanceState.APPLIED_FOR]) {
        summary.push({ reference: this.t('labels.appliedForOn'), value: this.report.log[AdvanceState.APPLIED_FOR].on })
      }
      summary.push({ reference: this.t('labels.approvedOn'), value: this.report.log[AdvanceState.APPROVED]?.on })
      summary.push({
        reference: this.t('labels.approvedBy'),
        value: `${this.drawer.formatter.name(this.report.log[AdvanceState.APPROVED]?.by.name)}`
      })
      if (this.report.receivedOn) {
        summary.push({ reference: this.t('labels.receivedOn'), value: this.report.receivedOn })
      }
    } else {
      if (reportIsTravel(this.report)) {
        if (this.report.log[TravelState.APPLIED_FOR]) {
          summary.push({ reference: this.t('labels.appliedForOn'), value: this.report.log[TravelState.APPLIED_FOR].on })
        }
        summary.push({ reference: this.t('labels.approvedOn'), value: this.report.log[TravelState.APPROVED]?.on })
        summary.push({
          reference: this.t('labels.approvedBy'),
          value: `${this.drawer.formatter.name(this.report.log[TravelState.APPROVED]?.by.name)}`
        })
      }
      summary.push({ reference: this.t('labels.submittedOn'), value: this.report.log[State.IN_REVIEW]?.on })
      summary.push({ reference: this.t('labels.examinedOn'), value: this.report.log[State.BOOKABLE]?.on })
      summary.push({
        reference: this.t('labels.examinedBy'),
        value: `${this.drawer.formatter.name(this.report.log[State.BOOKABLE]?.by.name)}`
      })
    }

    const tableOptions: TableOptions = options
    tableOptions.firstRow = false

    return await this.drawer.drawTable(summary, columns, tableOptions)
  }

  async drawComments(drawComments: boolean, drawBookingRemark: boolean, options: Options) {
    if ((this.report.comments.length === 0 || !drawComments) && (!this.report.bookingRemark || !drawBookingRemark)) {
      return options.yStart
    }
    const columns: Column[] = []
    columns.push({
      key: 'author',
      width: 120,
      alignment: TextAlignment.Left,
      title: 'author',
      fn: (a: Comment['author'] | string) => ((a as UserSimple).name ? this.drawer.formatter.name((a as UserSimple).name) : (a as string))
    })
    columns.push({ key: 'text', width: 300, alignment: TextAlignment.Left, title: 'value' })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.comments'), { xStart: options.xStart, yStart: options.yStart - fontSize, fontSize: fontSize })
    options.yStart -= fontSize * 1.25

    const tableOptions: TableOptions = options
    tableOptions.firstRow = false

    let rows: { author: Comment['author'] | string; text: string }[] = []
    if (drawComments) {
      rows = [...this.report.comments]
    }
    if (drawBookingRemark && this.report.bookingRemark) {
      rows.push({ author: this.t('labels.bookingRemark'), text: this.report.bookingRemark })
    }

    return await this.drawer.drawTable<{ author: Comment['author'] | string; text: string }>(rows, columns, tableOptions)
  }

  async drawStages(receiptMap: ReceiptMap<idType>, options: Options, drawNotes = true) {
    if (!reportIsTravel(this.report) || this.report.stages.length === 0) {
      return options.yStart
    }
    const travel = this.report
    const columns: Column[] = []
    columns.push({
      key: 'departure',
      width: 45,
      alignment: TextAlignment.Left,
      title: this.t('labels.departure'),
      fn: (d: Date) => this.drawer.formatter.simpleDateTime(d)
    })
    columns.push({
      key: 'arrival',
      width: 45,
      alignment: TextAlignment.Left,
      title: this.t('labels.arrival'),
      fn: (d: Date) => this.drawer.formatter.simpleDateTime(d)
    })
    columns.push({
      key: 'startLocation',
      width: 145,
      alignment: TextAlignment.Left,
      title: this.t('labels.startLocation'),
      fn: (p: Place) => `${p.place}, ${p.country.name[this.drawer.settings.language]}`,
      countryCodeForFlag: (p: Place) => p.country._id
    })
    columns.push({
      key: 'endLocation',
      width: 145,
      alignment: TextAlignment.Left,
      title: this.t('labels.endLocation'),
      fn: (p: Place) => `${p.place}, ${p.country.name[this.drawer.settings.language]}`,
      countryCodeForFlag: (p: Place) => p.country._id
    })
    columns.push({
      key: 'transport',
      width: 90,
      alignment: TextAlignment.Left,
      title: this.t('labels.transport'),
      fn: (t: Transport) =>
        t.type === 'ownCar'
          ? `${this.t(`distanceRefundTypes.${t.distanceRefundType}`)} (${this.travelSettings.distanceRefunds[t.distanceRefundType]} ${baseCurrency.symbol}/km)`
          : this.t(`labels.${t.type}`)
    })
    columns.push({
      key: 'transport',
      width: 65,
      alignment: TextAlignment.Right,
      title: this.t('labels.distance'),
      fn: (t: Transport) => (t.type === 'ownCar' ? String(t.distance) : EMPTY_CELL)
    })
    columns.push({
      key: 'purpose',
      width: 55,
      alignment: TextAlignment.Left,
      title: this.t('labels.purpose'),
      fn: (p: Purpose) =>
        this.t(`labels.${p}`) + (p === 'mixed' && travel.professionalShare ? ` (${Math.round(travel.professionalShare * 100)}%)` : '')
    })
    columns.push({
      key: 'cost',
      width: 80,
      alignment: TextAlignment.Right,
      title: this.t('labels.cost'),
      fn: (m: Cost) => this.drawer.formatter.detailedMoney(m)
    })
    if (drawNotes) {
      columns.push({ key: 'note', width: 70, alignment: TextAlignment.Left, title: this.t('labels.note') })
    }
    columns.push({
      key: 'cost',
      width: 45,
      alignment: TextAlignment.Left,
      title: this.t('labels.receiptNumber'),
      fn: (m: Cost) =>
        m.receipts
          .filter((r) => receiptMap[(r._id as _id).toString()]) // if vehicle registration is 'none', receipts for ownCar stages are not included
          .map((r) => receiptMap[(r._id as _id).toString()].number) // receipts always have an _id in backend
          .join(', ')
    })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.stages'), { xStart: options.xStart, yStart: options.yStart - fontSize, fontSize: fontSize })
    options.yStart -= fontSize * 1.25

    return await this.drawer.drawTable(this.report.stages, columns, options)
  }

  async drawExpenses(receiptMap: ReceiptMap<idType>, options: Options, drawNotes = true) {
    if (reportIsAdvance(this.report) || this.report.expenses.length === 0) {
      return options.yStart
    }
    const columns: Column[] = []
    columns.push({ key: 'description', width: 270, alignment: TextAlignment.Left, title: this.t('labels.description') })
    if (reportIsTravel(this.report)) {
      const travel = this.report
      columns.push({
        key: 'purpose',
        width: 55,
        alignment: TextAlignment.Left,
        title: this.t('labels.purpose'),
        fn: (p: TravelExpense['purpose']) =>
          this.t(`labels.${p}`) + (p === 'mixed' && travel.professionalShare ? ` (${Math.round(travel.professionalShare * 100)}%)` : '')
      })
    }
    columns.push({
      key: 'cost',
      width: 90,
      alignment: TextAlignment.Right,
      title: this.t('labels.cost'),
      fn: (m: Cost) => this.drawer.formatter.detailedMoney(m)
    })
    columns.push({
      key: 'cost',
      width: 90,
      alignment: TextAlignment.Left,
      title: this.t('labels.invoiceDate'),
      fn: (c: Cost) => this.drawer.formatter.date(c.date)
    })
    if (drawNotes) {
      columns.push({ key: 'note', width: 130, alignment: TextAlignment.Left, title: this.t('labels.note') })
    }
    columns.push({
      key: 'cost',
      width: 45,
      alignment: TextAlignment.Left,
      title: this.t('labels.receiptNumber'),
      fn: (m: Cost) => m.receipts.map((r) => receiptMap[(r._id as _id).toString()].number).join(', ') // receipts always have an _id in backend
    })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.expenses'), { xStart: options.xStart, yStart: options.yStart - fontSize, fontSize: fontSize })
    options.yStart -= fontSize * 1.25

    return await this.drawer.drawTable(this.report.expenses, columns, options)
  }

  async drawDays(options: Options) {
    if (!reportIsTravel(this.report) || this.report.days.length === 0) {
      return options.yStart
    }
    const columns: Column[] = []
    columns.push({
      key: 'date',
      width: 70,
      alignment: TextAlignment.Left,
      title: this.t('labels.date'),
      fn: (d: Date) => this.drawer.formatter.date(d)
    })
    columns.push({
      key: 'country',
      width: 120,
      alignment: TextAlignment.Left,
      title: this.t('labels.country'),
      fn: (c: CountrySimple) => c.name[this.drawer.settings.language],
      countryCodeForFlag: (c: CountrySimple) => c._id
    })
    columns.push({ key: 'special', width: 80, alignment: TextAlignment.Left, title: this.t('labels.city'), fn: (s?: string) => s || '' })
    columns.push({
      key: 'purpose',
      width: 55,
      alignment: TextAlignment.Left,
      title: this.t('labels.purpose'),
      fn: (p: PurposeSimple) => this.t(`labels.${p}`)
    })
    columns.push({
      key: 'cateringRefund',
      width: 120,
      alignment: TextAlignment.Left,
      title: this.t('labels.cateringNoRefund'),
      fn: (c: TravelDay['cateringRefund']) => (Object.keys(c) as Meal[]).map((k) => (c[k] ? '' : this.t(`labels.${k}`))).join(' ')
    })
    columns.push({
      key: 'lumpSums',
      width: 80,
      alignment: TextAlignment.Right,
      title: this.t('lumpSums.catering24/'),
      fn: (lumpSums: TravelDay['lumpSums']) => this.drawer.formatter.detailedMoney(lumpSums.catering.refund)
    })
    columns.push({
      key: 'lumpSums',
      width: 80,
      alignment: TextAlignment.Right,
      title: this.t('lumpSums.overnight/'),
      fn: (lumpSums: TravelDay['lumpSums']) => this.drawer.formatter.detailedMoney(lumpSums.overnight.refund)
    })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.lumpSums') + (this.report.claimSpouseRefund ? ` (${this.t('labels.claimSpouseRefund')})` : ''), {
      xStart: options.xStart,
      yStart: options.yStart - fontSize,
      fontSize: fontSize
    })
    options.yStart -= fontSize * 1.25

    return await this.drawer.drawTable(this.report.days, columns, options)
  }

  async drawReports(options: Options) {
    if (!reportIsAdvance(this.report) || this.report.offsetAgainst.length === 0) {
      return options.yStart
    }
    const columns: Column[] = []
    columns.push({ key: 'subject', width: 280, alignment: TextAlignment.Left, title: this.t('labels.subject') })
    columns.push({
      key: 'type',
      width: 105,
      alignment: TextAlignment.Left,
      title: this.t('labels.type'),
      fn: (t: ReportModelNameWithoutAdvance | 'offsetEntry') =>
        t === 'offsetEntry' ? this.t('labels.offsetEntry') : this.t(`labels.${getReportTypeFromModelName(t)}`)
    })
    columns.push({
      key: 'amount',
      width: 100,
      alignment: TextAlignment.Right,
      title: this.t('labels.amount'),
      fn: (a: number) => this.drawer.formatter.money({ amount: a })
    })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.offsetAgainst'), { xStart: options.xStart, yStart: options.yStart - fontSize, fontSize: fontSize })
    options.yStart -= fontSize * 1.25

    return await this.drawer.drawTable(this.report.offsetAgainst, columns, options)
  }
  t(textIdentifier: string, interpolation: Record<string, string> = {}) {
    return this.translateFunc(textIdentifier, this.drawer.settings.language, interpolation)
  }
}
