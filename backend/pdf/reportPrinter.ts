import pdf_lib from 'pdf-lib'
import Formatter from '../../common/formatter.js'
import { getAddUpTableData, getTotalBalance } from '../../common/scripts.js'
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
  getReportTypeFromModelName,
  HealthCareCost,
  Locale,
  Meal,
  Place,
  PrinterSettings,
  Purpose,
  PurposeSimple,
  ReportModelName,
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
  TravelState
} from '../../common/types.js'
import { Column, EMPTY_CELL, Options, PDFDrawer, Printer, ReceiptMap, TableOptions } from './printer.js'

function getReceiptMap(costList: { cost: Cost }[], number = 1) {
  let counter = number
  const map: ReceiptMap = {}
  for (const cost of costList) {
    if (cost.cost?.receipts) {
      for (const receipt of cost.cost.receipts) {
        map[receipt._id.toString()] = Object.assign({ number: counter++, date: cost.cost.date as Date }, receipt)
      }
    }
  }
  return { map, number }
}

export class ReportPrinter extends Printer {
  distanceRefunds: TravelSettings['distanceRefunds']

  constructor(
    settings: PrinterSettings,
    distanceRefunds: TravelSettings['distanceRefunds'],
    formatter: Formatter,
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string,
    getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById']
  ) {
    super(settings, formatter, translateFunc, getDocumentFileBufferById, getOrganisationLogoIdById)
    this.distanceRefunds = distanceRefunds
  }

  async print(report: Travel | ExpenseReport | HealthCareCost | Advance, language: Locale) {
    const print = await ReportPrint.create(
      report,
      this.settings,
      this.getDocumentFileBufferById,
      this.getOrganisationLogoIdById,
      this.distanceRefunds,
      this.formatter,
      this.translateFunc,
      language
    )
    return await print.run()
  }

  setDistanceRefunds(distanceRefunds: TravelSettings['distanceRefunds']) {
    this.distanceRefunds = distanceRefunds
  }
}

class ReportPrint {
  drawer: PDFDrawer
  report: Travel | ExpenseReport | HealthCareCost | Advance
  distanceRefunds: TravelSettings['distanceRefunds']
  translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string

  constructor(
    report: Travel | ExpenseReport | HealthCareCost | Advance,
    drawer: PDFDrawer,
    distanceRefunds: TravelSettings['distanceRefunds'],
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string
  ) {
    this.report = report
    this.drawer = drawer
    this.distanceRefunds = distanceRefunds
    this.translateFunc = translateFunc
  }

  static async create(
    report: Travel | ExpenseReport | HealthCareCost | Advance,
    settings: PrinterSettings,
    getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById'],
    distanceRefunds: TravelSettings['distanceRefunds'],
    formatter: Formatter,
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string,
    language: Locale
  ) {
    const drawer = await PDFDrawer.create(settings, getDocumentFileBufferById, getOrganisationLogoIdById, formatter, language, 'landscape')
    return new ReportPrint(report, drawer, distanceRefunds, translateFunc)
  }

  async run() {
    let y = this.drawer.currentPage.getSize().height
    await this.drawer.drawLogo(this.t('headlines.title'), {
      fontSize: this.drawer.settings.fontSizes.L,
      xStart: this.drawer.settings.pagePadding / 3,
      yStart: y - this.drawer.settings.pagePadding / 3
    })
    await this.drawer.drawOrganisationLogo(this.report.project.organisation, {
      xStart: this.drawer.currentPage.getSize().width - 166,
      yStart: y - 66,
      maxHeight: 50,
      maxWidth: 150
    })
    y = y - this.drawer.settings.pagePadding

    y =
      this.drawNameAndProject({ xStart: this.drawer.settings.pagePadding, yStart: y - 24, fontSize: this.drawer.settings.fontSizes.M }) - 10
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

    const receiptMap = {}
    if (!reportIsAdvance(this.report)) {
      const optionalMapTravel = reportIsTravel(this.report) ? getReceiptMap(this.report.stages) : { map: {}, number: 1 }
      Object.assign(receiptMap, optionalMapTravel.map, getReceiptMap(this.report.expenses, optionalMapTravel.number).map)
    }
    let yDates = y
    y = await this.drawSummary({ xStart: this.drawer.settings.pagePadding, yStart: y, fontSize: this.drawer.settings.fontSizes.M })

    yDates = await this.drawDates({
      xStart: this.drawer.currentPage.getSize().width - this.drawer.settings.pagePadding - 175, // 175: width of dates table
      yStart: yDates,
      fontSize: this.drawer.settings.fontSizes.S
    })
    y = y < yDates ? y : yDates

    y = await this.drawStages(receiptMap, {
      xStart: this.drawer.settings.pagePadding,
      yStart: y - 16,
      fontSize: this.drawer.settings.fontSizes.S
    })
    y = await this.drawExpenses(receiptMap, {
      xStart: this.drawer.settings.pagePadding,
      yStart: y - 16,
      fontSize: this.drawer.settings.fontSizes.S
    })
    y = await this.drawDays({ xStart: this.drawer.settings.pagePadding, yStart: y - 16, fontSize: this.drawer.settings.fontSizes.S })
    y = await this.drawReports({ xStart: this.drawer.settings.pagePadding, yStart: y - 16, fontSize: this.drawer.settings.fontSizes.S })
    y = await this.drawComments({ xStart: this.drawer.settings.pagePadding, yStart: y - 16, fontSize: this.drawer.settings.fontSizes.S })

    await this.drawer.attachReceipts(receiptMap)

    return await this.drawer.finish()
  }

  drawNameAndProject(options: Options) {
    let y = options.yStart
    y = this.drawer.drawMultilineText(this.report.name, { xStart: options.xStart, yStart: y, fontSize: options.fontSize * 1.5 })
    y = this.drawer.drawMultilineText(
      `${this.t('labels.project')}: ${this.report.project.identifier}${this.report.project.name ? ` - ${this.report.project.name}` : ''}`,
      { xStart: options.xStart, yStart: y, fontSize: options.fontSize }
    )
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
      // Dates
      const text = `${this.t('labels.from')}: ${this.drawer.formatter.date(this.report.expenses[0].cost.date)}    ${this.t('labels.to')}: ${this.drawer.formatter.date(this.report.expenses[this.report.expenses.length - 1].cost.date)}`
      y = this.drawer.drawMultilineText(text, { xStart: options.xStart, yStart: y, fontSize: options.fontSize })
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
        `${this.t('labels.applicant')}: ${this.drawer.formatter.name(this.report.owner.name)}      ${this.t('labels.reason')}: ${this.report.reason}`,
        { xStart: options.xStart, yStart: y, fontSize: options.fontSize }
      )
    }
    return y
  }

  async drawSummary(options: Options) {
    const columns: Column[] = []
    columns.push({ key: '0', width: 100, alignment: pdf_lib.TextAlignment.Left, title: 'title', fn: (l: string) => this.t(l) })
    const moneyColumn = (key: string) => ({ key, width: 75, alignment: pdf_lib.TextAlignment.Right, title: 'title' })
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
    columns.push({ key: 'reference', width: 80, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
    columns.push({
      key: 'value',
      width: 95,
      alignment: pdf_lib.TextAlignment.Left,
      title: 'value',
      fn: (d: Date | string) => (typeof d === 'string' ? d : this.drawer.formatter.date(d))
    })

    const summary = []
    if (reportIsAdvance(this.report)) {
      summary.push({
        reference: this.t('labels.appliedForOn'),
        value: this.report.log[AdvanceState.APPLIED_FOR]?.on || this.report.createdAt
      })
      summary.push({ reference: this.t('labels.approvedOn'), value: this.report.log[AdvanceState.APPROVED]?.on })
      summary.push({
        reference: this.t('labels.approvedBy'),
        value: `${this.drawer.formatter.name(this.report.log[AdvanceState.APPROVED]?.by.name)}`
      })
    } else {
      if (reportIsTravel(this.report)) {
        summary.push({
          reference: this.t('labels.appliedForOn'),
          value: this.report.log[TravelState.APPLIED_FOR]?.on || this.report.createdAt
        })
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

    const tabelOptions: TableOptions = options
    tabelOptions.firstRow = false

    return await this.drawer.drawTable(summary, columns, tabelOptions)
  }

  async drawComments(options: Options) {
    if (this.report.comments.length === 0) {
      return options.yStart
    }
    const columns: Column[] = []
    columns.push({
      key: 'author',
      width: 120,
      alignment: pdf_lib.TextAlignment.Left,
      title: 'author',
      fn: (a: Comment['author']) => `${this.drawer.formatter.name(a.name)}`
    })
    columns.push({ key: 'text', width: 300, alignment: pdf_lib.TextAlignment.Left, title: 'value' })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.comments'), { xStart: options.xStart, yStart: options.yStart - fontSize, fontSize: fontSize })
    options.yStart -= fontSize * 1.25

    const tabelOptions: TableOptions = options
    tabelOptions.firstRow = false

    return await this.drawer.drawTable<Comment<AnyState>>(this.report.comments, columns, tabelOptions)
  }

  async drawStages(receiptMap: ReceiptMap, options: Options) {
    if (!reportIsTravel(this.report) || this.report.stages.length === 0) {
      return options.yStart
    }
    const travel = this.report
    const columns: Column[] = []
    columns.push({
      key: 'departure',
      width: 45,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.departure'),
      fn: (d: Date) => this.drawer.formatter.simpleDateTime(d)
    })
    columns.push({
      key: 'arrival',
      width: 45,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.arrival'),
      fn: (d: Date) => this.drawer.formatter.simpleDateTime(d)
    })
    columns.push({
      key: 'startLocation',
      width: 145,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.startLocation'),
      fn: (p: Place) => `${p.place}, ${p.country.name[this.drawer.settings.language]}`,
      countryCodeForFlag: (p: Place) => p.country._id
    })
    columns.push({
      key: 'endLocation',
      width: 145,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.endLocation'),
      fn: (p: Place) => `${p.place}, ${p.country.name[this.drawer.settings.language]}`,
      countryCodeForFlag: (p: Place) => p.country._id
    })
    columns.push({
      key: 'transport',
      width: 90,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.transport'),
      fn: (t: Transport) =>
        t.type === 'ownCar'
          ? `${this.t(`distanceRefundTypes.${t.distanceRefundType}`)} (${this.distanceRefunds[t.distanceRefundType]} ${baseCurrency.symbol}/km)`
          : this.t(`labels.${t.type}`)
    })
    columns.push({
      key: 'transport',
      width: 65,
      alignment: pdf_lib.TextAlignment.Right,
      title: this.t('labels.distance'),
      fn: (t: Transport) => (t.type === 'ownCar' ? String(t.distance) : EMPTY_CELL)
    })
    columns.push({
      key: 'purpose',
      width: 50,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.purpose'),
      fn: (p: Purpose) =>
        this.t(`labels.${p}`) + (p === 'mixed' && travel.professionalShare ? ` (${Math.round(travel.professionalShare * 100)}%)` : '')
    })
    columns.push({
      key: 'cost',
      width: 80,
      alignment: pdf_lib.TextAlignment.Right,
      title: this.t('labels.cost'),
      fn: (m: Cost) => this.drawer.formatter.detailedMoney(m)
    })
    columns.push({ key: 'note', width: 70, alignment: pdf_lib.TextAlignment.Left, title: this.t('labels.note') })
    columns.push({
      key: 'cost',
      width: 45,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.receiptNumber'),
      fn: (m: Cost) => m.receipts.map((r) => receiptMap[r._id?.toString()].number).join(', ')
    })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.stages'), { xStart: options.xStart, yStart: options.yStart - fontSize, fontSize: fontSize })
    options.yStart -= fontSize * 1.25

    return await this.drawer.drawTable(this.report.stages, columns, options)
  }

  async drawExpenses(receiptMap: ReceiptMap, options: Options) {
    if (reportIsAdvance(this.report) || this.report.expenses.length === 0) {
      return options.yStart
    }
    const columns: Column[] = []
    columns.push({ key: 'description', width: 270, alignment: pdf_lib.TextAlignment.Left, title: this.t('labels.description') })
    if (reportIsTravel(this.report)) {
      const travel = this.report
      columns.push({
        key: 'purpose',
        width: 50,
        alignment: pdf_lib.TextAlignment.Left,
        title: this.t('labels.purpose'),
        fn: (p: TravelExpense['purpose']) =>
          this.t(`labels.${p}`) + (p === 'mixed' && travel.professionalShare ? ` (${Math.round(travel.professionalShare * 100)}%)` : '')
      })
    }
    columns.push({
      key: 'cost',
      width: 90,
      alignment: pdf_lib.TextAlignment.Right,
      title: this.t('labels.cost'),
      fn: (m: Cost) => this.drawer.formatter.detailedMoney(m)
    })
    columns.push({
      key: 'cost',
      width: 90,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.invoiceDate'),
      fn: (c: Cost) => this.drawer.formatter.date(c.date)
    })
    columns.push({ key: 'note', width: 130, alignment: pdf_lib.TextAlignment.Left, title: this.t('labels.note') })
    columns.push({
      key: 'cost',
      width: 45,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.receiptNumber'),
      fn: (m: Cost) => m.receipts.map((r) => receiptMap[r._id?.toString()].number).join(', ')
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
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.date'),
      fn: (d: Date) => this.drawer.formatter.date(d)
    })
    columns.push({
      key: 'country',
      width: 120,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.country'),
      fn: (c: CountrySimple) => c.name[this.drawer.settings.language],
      countryCodeForFlag: (c: CountrySimple) => c._id
    })
    columns.push({
      key: 'special',
      width: 80,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.city'),
      fn: (s?: string) => s || ''
    })
    columns.push({
      key: 'purpose',
      width: 50,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.purpose'),
      fn: (p: PurposeSimple) => this.t(`labels.${p}`)
    })
    columns.push({
      key: 'cateringRefund',
      width: 120,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.cateringNoRefund'),
      fn: (c: TravelDay['cateringRefund']) => (Object.keys(c) as Meal[]).map((k) => (c[k] ? '' : this.t(`labels.${k}`))).join(' ')
    })
    columns.push({
      key: 'lumpSums',
      width: 80,
      alignment: pdf_lib.TextAlignment.Right,
      title: this.t('lumpSums.catering24\n'),
      fn: (lumpSums: TravelDay['lumpSums']) => this.drawer.formatter.detailedMoney(lumpSums.catering.refund)
    })
    columns.push({
      key: 'lumpSums',
      width: 80,
      alignment: pdf_lib.TextAlignment.Right,
      title: this.t('lumpSums.overnight\n'),
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
    columns.push({
      key: 'report',
      width: 280,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.name'),
      fn: (r: { name: string } | null) => r?.name ?? ''
    })
    columns.push({
      key: 'type',
      width: 105,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.type'),
      fn: (t: ReportModelName) => this.t(`labels.${getReportTypeFromModelName(t)}`)
    })
    columns.push({
      key: 'amount',
      width: 100,
      alignment: pdf_lib.TextAlignment.Right,
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
