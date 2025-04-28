import fs from 'node:fs/promises'
import pdf_fontkit from 'pdf-fontkit'
import pdf_lib, { PDFName, PDFString } from 'pdf-lib'
import Formatter from '../../common/formatter.js'
import { addUp, hexToRGB } from '../../common/scripts.js'
import {
  Advance,
  Comment,
  Cost,
  CountryCode,
  CountrySimple,
  DocumentFile,
  DocumentFileType,
  ExpenseReport,
  HealthCareCost,
  Locale,
  Meal,
  Money,
  PageOrientation,
  Place,
  PrintSettingsBase,
  PrinterSettings,
  Purpose,
  PurposeSimple,
  Refund,
  Transport,
  Travel,
  TravelDay,
  TravelExpense,
  TravelSettings,
  _id,
  baseCurrency,
  reportIsAdvance,
  reportIsExpenseReport,
  reportIsHealthCareCost,
  reportIsTravel
} from '../../common/types.js'

interface PrintSettings extends PrintSettingsBase {
  language: Locale
  defaultPageOrientation: PageOrientation
}

interface PrintSettingsWithColorObjects extends Omit<PrintSettings, 'textColor' | 'borderColor'> {
  textColor: pdf_lib.Color
  borderColor: pdf_lib.Color
}

export interface Options {
  fontSize: number
  xStart: number
  yStart: number
}

export interface TableOptions extends Options {
  cellHeight?: number
  defaultCellWidth?: number
  firstRow?: boolean
}

export interface Column {
  key: string
  width: number
  alignment: pdf_lib.TextAlignment
  title: string
  fn?: (p: any) => string | undefined
  countryCodeForFlag?: (p: any) => CountryCode
}
interface ReceiptMapEntry extends DocumentFile {
  number: number
  date: Date
  noNumberPrint?: boolean
}
export interface ReceiptMap {
  [key: string]: ReceiptMapEntry
}

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

export class ReportPrinter {
  formatter: Formatter
  distanceRefunds: TravelSettings['distanceRefunds']
  settings: PrinterSettings
  getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById']
  getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById']
  translateFunc: (textIdentifier: string, language: Locale, interpolation?: any) => string

  constructor(
    settings: PrinterSettings,
    distanceRefunds: TravelSettings['distanceRefunds'],
    formatter: Formatter,
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: any) => string,
    getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById']
  ) {
    this.settings = settings
    this.formatter = formatter
    this.distanceRefunds = distanceRefunds
    this.getDocumentFileBufferById = getDocumentFileBufferById
    this.getOrganisationLogoIdById = getOrganisationLogoIdById
    this.translateFunc = translateFunc
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

  setSettings(settings: PrinterSettings) {
    this.settings = settings
  }

  setDistanceRefunds(distanceRefunds: TravelSettings['distanceRefunds']) {
    this.distanceRefunds = distanceRefunds
  }
}

class ReportPrint {
  drawer: PDFDrawer
  report: Travel | ExpenseReport | HealthCareCost | Advance
  distanceRefunds: TravelSettings['distanceRefunds']
  translateFunc: (textIdentifier: string, language: Locale, interpolation?: any) => string

  constructor(
    report: Travel | ExpenseReport | HealthCareCost | Advance,
    drawer: PDFDrawer,
    distanceRefunds: TravelSettings['distanceRefunds'],
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: any) => string
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
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: any) => string,
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
      this.drawNameAndProject({
        xStart: this.drawer.settings.pagePadding,
        yStart: y - 24,
        fontSize: this.drawer.settings.fontSizes.M
      }) - 10
    y = await this.drawTravelInformation({
      xStart: this.drawer.settings.pagePadding,
      yStart: y,
      fontSize: this.drawer.settings.fontSizes.M
    })
    y = this.drawExpenseInformation({
      xStart: this.drawer.settings.pagePadding,
      yStart: y,
      fontSize: this.drawer.settings.fontSizes.M
    })
    y = this.drawHealthCareCostInformation({
      xStart: this.drawer.settings.pagePadding,
      yStart: y,
      fontSize: this.drawer.settings.fontSizes.M
    })
    y = this.drawAdvanceApprovedText({
      xStart: this.drawer.settings.pagePadding,
      yStart: y,
      fontSize: this.drawer.settings.fontSizes.M
    })

    const receiptMap = {}
    if (!reportIsAdvance(this.report)) {
      const optionalMapTravel = reportIsTravel(this.report) ? getReceiptMap(this.report.stages) : { map: {}, number: 1 }
      const optionalMapHealth: ReceiptMap = {}
      if (reportIsHealthCareCost(this.report) && this.report.refundSum.receipts && this.report.refundSum.receipts.length > 0) {
        for (const receipt of this.report.refundSum.receipts) {
          optionalMapHealth[receipt._id?.toString()] = Object.assign({ number: 0, date: new Date(), noNumberPrint: true }, receipt)
        }
      }
      Object.assign(receiptMap, optionalMapTravel.map, optionalMapHealth, getReceiptMap(this.report.expenses, optionalMapTravel.number).map)
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
    y = await this.drawDays({
      xStart: this.drawer.settings.pagePadding,
      yStart: y - 16,
      fontSize: this.drawer.settings.fontSizes.S
    })
    y = await this.drawComments({
      xStart: this.drawer.settings.pagePadding,
      yStart: y - 16,
      fontSize: this.drawer.settings.fontSizes.S
    })

    await this.drawer.attachReceipts(receiptMap)

    return await this.drawer.finish()
  }

  drawNameAndProject(options: Options) {
    let y = options.yStart
    y = this.drawer.drawMultilineText(this.report.name, { xStart: options.xStart, yStart: y, fontSize: options.fontSize * 1.5 })
    y = this.drawer.drawMultilineText(
      `${this.t('labels.project')}: ${this.report.project.identifier}${this.report.project.name ? ` - ${this.report.project.name}` : ''}`,
      {
        xStart: options.xStart,
        yStart: y,
        fontSize: options.fontSize
      }
    )
    return y
  }

  async drawTravelInformation(options: Options) {
    let y = options.yStart
    if (reportIsTravel(this.report)) {
      // Traveler
      y = this.drawer.drawMultilineText(
        `${this.t('labels.traveler')}: ${this.report.owner.name.givenName} ${this.report.owner.name.familyName}${this.report.claimSpouseRefund ? ` & ${this.report.fellowTravelersNames}` : ''}`,
        {
          xStart: options.xStart,
          yStart: y,
          fontSize: options.fontSize
        }
      )

      // Reason + Place
      y = await this.drawer.drawMultilineTextWithPlace(
        `${this.t('labels.reason')}: ${this.report.reason}    ${this.t('labels.destinationPlace')}: `,
        this.report.destinationPlace,
        {
          xStart: options.xStart,
          yStart: y,
          fontSize: options.fontSize
        }
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
        `${this.t('labels.expensePayer')}: ${this.report.owner.name.givenName} ${this.report.owner.name.familyName}`,
        {
          xStart: options.xStart,
          yStart: y,
          fontSize: options.fontSize
        }
      )
      // Dates
      const text = `${this.t('labels.from')}: ${this.drawer.formatter.date(this.report.expenses[0].cost.date)}    ${this.t('labels.to')}: ${this.drawer.formatter.date(this.report.expenses[this.report.expenses.length - 1].cost.date)}`
      y = this.drawer.drawMultilineText(text, {
        xStart: options.xStart,
        yStart: y,
        fontSize: options.fontSize
      })
    }
    return y
  }

  drawHealthCareCostInformation(options: Options) {
    let y = options.yStart
    if (reportIsHealthCareCost(this.report)) {
      // Isurance + patientName
      y = this.drawer.drawMultilineText(
        `${this.t('labels.insurance')}: ${this.report.insurance.name}      ${this.t('labels.applicant')}: ${this.report.owner.name.givenName} ${this.report.owner.name.familyName}      ${this.t('labels.patientName')}: ${this.report.patientName}`,
        {
          xStart: options.xStart,
          yStart: y,
          fontSize: options.fontSize
        }
      )
    }
    return y
  }

  drawAdvanceApprovedText(options: Options) {
    let y = options.yStart
    if (reportIsAdvance(this.report)) {
      y = this.drawer.drawMultilineText(
        this.t('report.advance.approvedXonYbyZ', {
          X: this.drawer.formatter.detailedMoney(this.report.budget, true),
          Y: this.drawer.formatter.date(this.report.updatedAt),
          Z: `${this.report.editor.name.givenName} ${this.report.editor.name.familyName}`
        }),
        {
          xStart: options.xStart,
          yStart: y,
          fontSize: options.fontSize
        }
      )
    }
    return y
  }

  async drawSummary(options: Options) {
    const columns: Column[] = []
    columns.push({ key: 'reference', width: 100, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
    columns.push({
      key: 'sum',
      width: 85,
      alignment: pdf_lib.TextAlignment.Right,
      title: 'sum',
      fn: (m: Money) => this.drawer.formatter.detailedMoney(m, true)
    })

    const summary = []

    if (reportIsTravel(this.report)) {
      const addedUp = addUp(this.report)
      summary.push({ reference: this.t('labels.lumpSums'), sum: addedUp.lumpSums })
      summary.push({ reference: this.t('labels.expenses'), sum: addedUp.expenses })
      if (addedUp.advance.amount !== null && addedUp.advance.amount > 0) {
        addedUp.advance.amount = -1 * addedUp.advance.amount
        summary.push({ reference: this.t('labels.advance'), sum: addedUp.advance })
      }
      summary.push({ reference: this.t('labels.balance'), sum: addedUp.balance })
    } else if (reportIsHealthCareCost(this.report)) {
      const addedUp = addUp(this.report)
      summary.push({ reference: this.t('labels.balance'), sum: addedUp.balance })
      if (this.report.state === 'refunded') {
        summary.push({ reference: this.t('labels.refundSum'), sum: this.report.refundSum })
      }
    } else if (reportIsAdvance(this.report)) {
      summary.push({ reference: this.t('labels.advance'), sum: this.report.budget })
    } else {
      const addedUp = addUp(this.report)
      if (addedUp.advance.amount !== null && addedUp.advance.amount > 0) {
        addedUp.advance.amount = -1 * addedUp.advance.amount
        summary.push({ reference: this.t('labels.expenses'), sum: addedUp.expenses })
        summary.push({ reference: this.t('labels.advance'), sum: addedUp.advance })
      }
      summary.push({ reference: this.t('labels.balance'), sum: addedUp.balance })
    }

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.summary'), {
      xStart: options.xStart,
      yStart: options.yStart - fontSize,
      fontSize: fontSize
    })
    const tabelOptions: TableOptions = options
    tabelOptions.yStart -= fontSize * 1.25
    tabelOptions.firstRow = false

    return await this.drawer.drawTable(summary, columns, tabelOptions)
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
    if (reportIsTravel(this.report) || reportIsAdvance(this.report)) {
      summary.push({ reference: this.t('labels.appliedForOn'), value: this.report.createdAt })
      summary.push({
        reference: this.t('labels.approvedOn'),
        value: this.report.log.appliedFor?.date
      })
      summary.push({
        reference: this.t('labels.approvedBy'),
        value: `${this.report.log.appliedFor?.editor.name.givenName} ${this.report.log.appliedFor?.editor.name.familyName}`
      })
    } else {
      summary.push({
        reference: this.t('labels.submittedOn'),
        value: this.report.log.inWork?.date
      })
    }
    if (reportIsTravel(this.report)) {
      summary.push({
        reference: this.t('labels.submittedOn'),
        value: this.report.log.approved?.date
      })
    }
    if (!reportIsAdvance(this.report)) {
      summary.push({ reference: this.t('labels.examinedOn'), value: this.report.log.underExamination?.date })
      summary.push({
        reference: this.t('labels.examinedBy'),
        value: `${this.report.editor.name.givenName} ${this.report.editor.name.familyName}`
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
      fn: (a: Comment['author']) => `${a.name.givenName} ${a.name.familyName}`
    })
    columns.push({
      key: 'text',
      width: 300,
      alignment: pdf_lib.TextAlignment.Left,
      title: 'value'
    })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.comments'), {
      xStart: options.xStart,
      yStart: options.yStart - fontSize,
      fontSize: fontSize
    })
    options.yStart -= fontSize * 1.25

    const tabelOptions: TableOptions = options
    tabelOptions.firstRow = false

    return await this.drawer.drawTable(this.report.comments, columns, tabelOptions)
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
      fn: (t: Transport) => (t.type === 'ownCar' ? String(t.distance) : undefined)
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
    columns.push({
      key: 'note',
      width: 70,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.note')
    })
    columns.push({
      key: 'cost',
      width: 45,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.receiptNumber'),
      fn: (m: Cost) => m.receipts.map((r) => receiptMap[r._id?.toString()].number).join(', ')
    })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.stages'), {
      xStart: options.xStart,
      yStart: options.yStart - fontSize,
      fontSize: fontSize
    })
    options.yStart -= fontSize * 1.25

    return await this.drawer.drawTable(this.report.stages, columns, options)
  }

  async drawExpenses(receiptMap: ReceiptMap, options: Options) {
    if (reportIsAdvance(this.report) || this.report.expenses.length === 0) {
      return options.yStart
    }
    const columns: Column[] = []
    columns.push({
      key: 'description',
      width: 270,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.description')
    })
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
    columns.push({
      key: 'note',
      width: 130,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.note')
    })
    columns.push({
      key: 'cost',
      width: 45,
      alignment: pdf_lib.TextAlignment.Left,
      title: this.t('labels.receiptNumber'),
      fn: (m: Cost) => m.receipts.map((r) => receiptMap[r._id?.toString()].number).join(', ')
    })

    const fontSize = options.fontSize + 2
    this.drawer.drawText(this.t('labels.expenses'), {
      xStart: options.xStart,
      yStart: options.yStart - fontSize,
      fontSize: fontSize
    })
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
  t(textIdentifier: string, interpolation: any = {}) {
    return this.translateFunc(textIdentifier, this.drawer.settings.language, interpolation) as string
  }
}

// From https://github.com/Hopding/pdf-lib
// biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
const lineSplit = (text: string) => text.split(/[\n\f\r\u000B]/)
const cleanText = (text: string) => text.replace(/\t|\u0085|\u2028|\u2029/g, '    ').replace(/[\b\v]/g, '')
const lastIndexOfWhitespace = (line: string) => {
  for (let idx = line.length; idx > 0; idx--) {
    if (/\s/.test(line[idx])) return idx
  }
  return undefined
}
const splitOutLines = (input: string, maxWidth: number, font: pdf_lib.PDFFont, fontSize: number) => {
  let lastWhitespaceIdx = input.length
  while (lastWhitespaceIdx > 0) {
    const line = input.substring(0, lastWhitespaceIdx)
    const encoded = font.encodeText(line)
    const width = font.widthOfTextAtSize(line, fontSize)
    if (width < maxWidth) {
      const remainder = input.substring(lastWhitespaceIdx) || undefined
      return { line, encoded, width, remainder }
    }
    lastWhitespaceIdx = lastIndexOfWhitespace(line) ?? 0
  }

  // We were unable to split the input enough to get a chunk that would fit
  // within the specified `maxWidth` so we'll just return everything
  return {
    line: input,
    encoded: font.encodeText(input),
    width: font.widthOfTextAtSize(input, fontSize),
    remainder: undefined
  }
}

const layoutMultilineText = (
  text: string,
  { alignment, fontSize, font, bounds, lineHeightFactor }: pdf_lib.LayoutTextOptions & { lineHeightFactor?: number }
): pdf_lib.MultilineTextLayout => {
  const lines = lineSplit(cleanText(text))

  if (fontSize === undefined || fontSize === 0) {
    fontSize = 12
  }
  if (lineHeightFactor === undefined) {
    lineHeightFactor = 0.2
  }
  const height = font.heightAtSize(fontSize)
  const lineHeight = height + height * lineHeightFactor

  const textLines: pdf_lib.TextPosition[] = []

  let minX = bounds.x
  let minY = bounds.y
  let maxX = bounds.x + bounds.width
  let maxY = bounds.y + bounds.height

  let y = bounds.y + bounds.height
  for (let idx = 0, len = lines.length; idx < len; idx++) {
    let prevRemainder: string | undefined = lines[idx]
    while (prevRemainder !== undefined) {
      const { line, encoded, width, remainder } = splitOutLines(prevRemainder, bounds.width, font, fontSize)

      // prettier-ignore
      const x =
        alignment === pdf_lib.TextAlignment.Left
          ? bounds.x
          : alignment === pdf_lib.TextAlignment.Center
            ? bounds.x + bounds.width / 2 - width / 2
            : alignment === pdf_lib.TextAlignment.Right
              ? bounds.x + bounds.width - width
              : bounds.x

      y -= lineHeight

      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x + width > maxX) maxX = x + width
      if (y + height > maxY) maxY = y + height

      textLines.push({ text: line, encoded, width, height, x, y })

      // Only trim lines that we had to split ourselves. So we won't trim lines
      // that the user provided themselves with whitespace.
      prevRemainder = remainder?.trim()
    }
  }

  return {
    fontSize,
    lineHeight,
    lines: textLines,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }
}

const FLAG_PSEUDO_SUFFIX = 'mim'
const EMPTY_CELL = '---'

class PDFDrawer {
  font: pdf_lib.PDFFont
  doc: pdf_lib.PDFDocument
  formatter: Formatter
  settings: PrintSettingsWithColorObjects
  currentPage!: pdf_lib.PDFPage
  getDocumentFileBufferById: (id: _id) => Promise<{ buffer: Uint8Array<ArrayBufferLike>; type: DocumentFileType } | null>
  getOrganisationLogoIdById: (id: _id) => Promise<{ logoId: _id; website?: string | null } | null>

  constructor(
    settings: PrintSettings,
    doc: pdf_lib.PDFDocument,
    getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById'],
    font: pdf_lib.PDFFont,
    formatter: Formatter
  ) {
    this.doc = doc
    this.font = font
    this.formatter = formatter
    this.settings = Object.assign({}, settings, {
      textColor: pdf_lib.componentsToColor(hexToRGB(settings.textColor)),
      borderColor: pdf_lib.componentsToColor(hexToRGB(settings.borderColor))
    })
    this.getDocumentFileBufferById = getDocumentFileBufferById
    this.getOrganisationLogoIdById = getOrganisationLogoIdById
    this.formatter.setLocale(this.settings.language)
    this.newPage()
  }

  static async create(
    settings: PrinterSettings,
    getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById'],
    formatter: Formatter,
    language: Locale,
    defaultPageOrientation: PageOrientation
  ) {
    const doc = await pdf_lib.PDFDocument.create()
    doc.registerFontkit(pdf_fontkit)
    const fontBytes = await fs.readFile(`../common/fonts/${settings.fontName}.ttf`)
    const font = await doc.embedFont(fontBytes, { subset: true })
    const printSettings = { ...settings, language, defaultPageOrientation }
    return new PDFDrawer(printSettings, doc, getDocumentFileBufferById, getOrganisationLogoIdById, font, formatter)
  }

  async finish() {
    return await this.doc.save()
  }

  newPage(orientation: PageOrientation = this.settings.defaultPageOrientation) {
    let size: [number, number]
    if (orientation === 'portrait') {
      size = [this.settings.pageSize.width, this.settings.pageSize.height]
    } else {
      size = [this.settings.pageSize.height, this.settings.pageSize.width]
    }
    this.currentPage = this.doc.addPage(size)
  }

  /**
   * returns bottom y end
   */
  drawMultilineText(text: string, options: Options & { alignment?: pdf_lib.TextAlignment; width?: number }) {
    const opts = Object.assign(options, {
      alignment: pdf_lib.TextAlignment.Left,
      width: this.currentPage.getSize().width - this.settings.pagePadding - options.xStart
    })
    const multiLineText = layoutMultilineText(text, {
      alignment: opts.alignment,
      font: this.font,
      fontSize: opts.fontSize,
      bounds: { width: opts.width, height: opts.fontSize, x: opts.xStart, y: opts.yStart },
      lineHeightFactor: 0
    })
    for (const line of multiLineText.lines) {
      this.drawText(line.text, { xStart: line.x, yStart: line.y, fontSize: opts.fontSize })
    }
    return opts.yStart - multiLineText.bounds.height
  }

  async drawMultilineTextWithPlace(
    text: string,
    place: { country: CountrySimple; place?: string },
    options: Options & { alignment?: pdf_lib.TextAlignment; width?: number }
  ) {
    let textWithPlace = text
    const opts = Object.assign(options, {
      alignment: pdf_lib.TextAlignment.Left,
      width: this.currentPage.getSize().width - this.settings.pagePadding - options.xStart
    })
    const flagPseudoSuffixWidth =
      this.font.widthOfTextAtSize(FLAG_PSEUDO_SUFFIX, options.fontSize) - this.font.widthOfTextAtSize(' ', options.fontSize)
    if (place.place) {
      textWithPlace += `${place.place}, `
    }
    textWithPlace += place.country.name[this.settings.language]
    textWithPlace += FLAG_PSEUDO_SUFFIX

    const multiLineText = layoutMultilineText(text, {
      alignment: opts.alignment,
      font: this.font,
      fontSize: opts.fontSize,
      bounds: { width: opts.width, height: opts.fontSize, x: opts.xStart, y: opts.yStart },
      lineHeightFactor: 0
    })
    const len = multiLineText.lines.length
    if (len > 0) {
      const lastLine = multiLineText.lines[len - 1]
      lastLine.text = lastLine.text.slice(0, lastLine.text.length - FLAG_PSEUDO_SUFFIX.length)

      for (const line of multiLineText.lines) {
        this.drawText(line.text, { xStart: line.x, yStart: line.y, fontSize: opts.fontSize })
      }
      await this.drawFlag(place.country._id, {
        xStart: lastLine.x + lastLine.width - flagPseudoSuffixWidth,
        yStart: lastLine.y,
        fontSize: opts.fontSize
      })
    }
    return opts.yStart - multiLineText.bounds.height
  }

  drawText(text: string, options: Options) {
    this.currentPage.drawText(text, {
      x: options.xStart,
      y: options.yStart,
      size: options.fontSize,
      font: this.font,
      color: this.settings.textColor
    })
  }

  drawReceiptNumber(receipt: ReceiptMapEntry) {
    if (receipt.noNumberPrint) {
      return
    }
    const text = `#${receipt.number}${receipt.date ? ` - ${this.formatter.date(receipt.date)}` : ''}`
    const width = this.font.widthOfTextAtSize(text, this.settings.fontSizes.L)
    this.currentPage.drawRectangle({
      x: 2,
      y: this.currentPage.getSize().height - (this.settings.fontSizes.L + 2),
      width: width,
      height: this.settings.fontSizes.L + 4,
      color: pdf_lib.rgb(1, 1, 1), //white
      opacity: 0.5
    })
    this.drawText(text, {
      xStart: 2,
      yStart: this.currentPage.getSize().height - (this.settings.fontSizes.L + 2),
      fontSize: this.settings.fontSizes.L
    })
  }

  async attachReceipts(receiptMap: ReceiptMap) {
    for (const receiptId in receiptMap) {
      const receipt = receiptMap[receiptId]
      const doc = await this.getDocumentFileBufferById(receipt._id)
      if (!doc) {
        console.error(`No DocumentFile found for id: ${receipt._id}`)
        continue
      }
      try {
        if (receipt.type === 'application/pdf') {
          const insertPDF = await pdf_lib.PDFDocument.load(doc.buffer)
          const pages = await this.doc.copyPages(insertPDF, insertPDF.getPageIndices())
          for (const p of pages) {
            this.currentPage = this.doc.addPage(p)
            this.drawReceiptNumber(receipt)
          }
        } else {
          let image: pdf_lib.PDFImage
          if (receipt.type === 'image/jpeg') {
            const zeroOffsetData = new Uint8Array(doc.buffer, 0)
            image = await this.doc.embedJpg(zeroOffsetData)
          } else {
            // receipt.type === 'image/png'
            image = await this.doc.embedPng(doc.buffer)
          }
          if (image.width > image.height) {
            this.newPage('landscape')
          } else {
            this.newPage('portrait')
          }
          let size = image.scaleToFit(
            this.currentPage.getSize().width - this.settings.pagePadding, // only half padding
            this.currentPage.getSize().height - this.settings.pagePadding
          )
          if (size.width > image.width) {
            size = image.size()
          }
          this.currentPage.drawImage(image, {
            x: (this.currentPage.getSize().width - size.width) / 2,
            y: (this.currentPage.getSize().height - size.height) / 2,
            width: size.width,
            height: size.height
          })
          this.drawReceiptNumber(receipt)
        }
      } catch (error) {
        console.error(`Error while trying to add Document (${receipt._id})[${doc.type}] to PDF: ${error}`)
      }
    }
  }

  async drawFlag(countryCode: CountryCode, options: Options) {
    const opts = options

    let filename = countryCode
    if (opts.fontSize > 42 * 0.75) {
      // 0.75 px <=> 1 pt
      filename = `${filename}@3x`
    } else if (opts.fontSize > 21 * 0.75) {
      // 0.75 px <=> 1 pt
      filename = `${filename}@2x`
    }
    const flagBytes = await fs.readFile(`./pdf/flags/${filename}.png`)
    const flag = await this.doc.embedPng(flagBytes)

    this.currentPage.drawImage(flag, {
      x: opts.xStart,
      y: opts.yStart - opts.fontSize / 9,
      height: opts.fontSize,
      width: opts.fontSize * (3 / 2)
    })
  }

  /**
   * Oben links (xStart, yStart)
   */
  async drawLogo(title: string, options: Options) {
    let filename = 'receipt'
    if (options.fontSize > 24) {
      filename = `${filename}36`
    } else if (options.fontSize > 12) {
      filename = `${filename}24`
    } else {
      filename = `${filename}12`
    }
    const logoBytes = await fs.readFile(`./pdf/receipt/${filename}.png`)
    const logo = await this.doc.embedPng(logoBytes)
    const logoSize = this.font.heightAtSize(options.fontSize)
    const y = options.yStart - logoSize * 0.8

    this.currentPage.drawImage(logo, {
      x: options.xStart,
      y: y - logoSize / 5,
      height: logoSize,
      width: logoSize
    })

    this.drawText(title, {
      xStart: options.xStart + logoSize + options.fontSize / 4,
      yStart: y,
      fontSize: options.fontSize
    })
  }

  async drawOrganisationLogo(organisationId: _id, options: { xStart: number; yStart: number; maxWidth: number; maxHeight: number }) {
    const orga = await this.getOrganisationLogoIdById(organisationId)
    if (!orga) {
      return
    }
    const doc = await this.getDocumentFileBufferById(orga.logoId)
    if (!doc) {
      console.error(`No DocumentFile found for id: ${orga.logoId}`)
      return
    }

    let image: pdf_lib.PDFImage
    if (doc.type === 'image/jpeg') {
      const zeroOffsetData = new Uint8Array(doc.buffer, 0)
      image = await this.doc.embedJpg(zeroOffsetData)
    } else {
      // receipt.type === 'image/png'
      image = await this.doc.embedPng(doc.buffer)
    }

    let size = image.scaleToFit(options.maxWidth, options.maxHeight)
    if (size.width > image.width) {
      size = image.size()
    }
    // align on right side
    const x = options.xStart + (options.maxWidth - size.width)
    const y = options.yStart + (options.maxHeight - size.height)

    if (orga.website) {
      this.drawLink(orga.website, { xStart: x, yStart: y, width: size.width, height: size.height })
    }
    this.currentPage.drawImage(image, {
      x: x,
      y: y,
      width: size.width,
      height: size.height
    })
  }

  drawLink(url: string, options: { xStart: number; yStart: number; width: number; height: number }) {
    const linkAnnotation = this.doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [options.xStart, options.yStart, options.xStart + options.width, options.yStart + options.height],
      Border: [0, 0, 0],
      C: [0, 0, 1],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(url)
      }
    })
    const linkAnnotationRef = this.doc.context.register(linkAnnotation)
    this.currentPage.node.set(PDFName.of('Annots'), this.doc.context.obj([linkAnnotationRef]))
  }

  async drawTable(data: any[], columns: Column[], options: TableOptions) {
    if (data.length === 0) {
      return options.yStart
    }
    const flagPseudoSuffixWidth =
      this.font.widthOfTextAtSize(FLAG_PSEUDO_SUFFIX, options.fontSize) - this.font.widthOfTextAtSize(' ', options.fontSize)
    const opts = Object.assign(
      {
        cellHeight: options.fontSize * 1.5,
        defaultCellWidth: 100,
        xStart: this.settings.pagePadding,
        yStart: this.currentPage.getSize().height - this.settings.pagePadding,
        newPageXStart: this.settings.pagePadding,
        newPageYStart: this.currentPage.getSize().height - this.settings.pagePadding,
        firstRow: true
      },
      options
    )

    opts.yStart = opts.yStart - opts.cellHeight
    opts.newPageYStart = opts.newPageYStart - opts.cellHeight

    let x = opts.xStart
    let y = opts.yStart
    for (let i = 0; i < data.length; i++) {
      x = opts.xStart
      let yMin = y
      const columnBorders: pdf_lib.PDFPageDrawLineOptions[] = []
      const cellTexts: {
        text: string
        options: {
          xStart: number
          yStart: number
          width: number
          fontSize: number
        }
        countryCodeForFlag?: CountryCode
      }[] = []
      for (const column of columns) {
        const datum = data[i][column.key]
        let cell = datum
        if (column.fn) {
          cell = column.fn(cell)
        }
        if (opts.firstRow) {
          cell = column.title
        }
        if (cell === undefined) {
          cell = EMPTY_CELL
        }
        const fontSize = opts.firstRow ? opts.fontSize + 1 : opts.fontSize
        const multiText = layoutMultilineText(cell.toString() + (column.countryCodeForFlag && !opts.firstRow ? FLAG_PSEUDO_SUFFIX : ''), {
          alignment: opts.firstRow ? pdf_lib.TextAlignment.Center : column.alignment,
          font: this.font,
          fontSize: fontSize,
          bounds: {
            width: column.width - this.settings.cellPadding.x * 3,
            height: fontSize,
            x: x,
            y: y
          },
          lineHeightFactor: 0
        })
        for (const line of multiText.lines) {
          cellTexts.push({
            text: line.text,
            options: {
              xStart: line.x + this.settings.cellPadding.x,
              yStart: line.y + this.settings.cellPadding.bottom,
              width: line.width,
              fontSize: fontSize
            }
          })
        }
        if (multiText.lines.length > 0 && !opts.firstRow) {
          if (column.countryCodeForFlag) {
            cellTexts[cellTexts.length - 1].text = cellTexts[cellTexts.length - 1].text.slice(
              0,
              cellTexts[cellTexts.length - 1].text.length - FLAG_PSEUDO_SUFFIX.length
            )
            cellTexts[cellTexts.length - 1].countryCodeForFlag = column.countryCodeForFlag(datum)
          }
        }

        columnBorders.push({
          // vertical border ╫
          start: { x: x - this.settings.borderThickness, y: y + opts.cellHeight - this.settings.borderThickness },
          end: { x: x - this.settings.borderThickness, y: 0 },
          thickness: this.settings.borderThickness,
          color: this.settings.borderColor
        })
        yMin = multiText.bounds.y < yMin ? multiText.bounds.y : yMin
        x = x + column.width
      }
      if (yMin < this.settings.pagePadding) {
        this.currentPage.drawLine({
          // top border ╤
          start: { x: opts.xStart - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
          end: { x: x - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
          thickness: this.settings.borderThickness,
          color: this.settings.borderColor
        })
        this.currentPage.drawLine({
          // right border ╢
          start: { x: x - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
          end: { x: x - this.settings.borderThickness, y: y + opts.cellHeight - this.settings.borderThickness },
          thickness: this.settings.borderThickness,
          color: this.settings.borderColor
        })
        this.newPage()
        x = opts.newPageXStart
        y = opts.newPageYStart
        opts.xStart = opts.newPageXStart
        opts.yStart = opts.newPageYStart
        i--
        continue
      }
      if (opts.firstRow) {
        opts.firstRow = false
        i--
      }
      for (const text of cellTexts) {
        this.drawText(text.text, text.options)
        if (text.countryCodeForFlag) {
          await this.drawFlag(text.countryCodeForFlag, {
            yStart: text.options.yStart,
            xStart: text.options.xStart + text.options.width - flagPseudoSuffixWidth,
            fontSize: text.options.fontSize
          })
        }
      }
      for (const border of columnBorders) {
        border.end.y = yMin - this.settings.borderThickness
        this.currentPage.drawLine(border)
      }
      y = yMin
      this.currentPage.drawLine({
        // horizontal border ╪
        start: { x: opts.xStart - this.settings.borderThickness, y: y - this.settings.borderThickness },
        end: { x: x - this.settings.borderThickness, y: y - this.settings.borderThickness },
        thickness: this.settings.borderThickness,
        color: this.settings.borderColor
      })
      y = y - opts.cellHeight
    }
    this.currentPage.drawLine({
      // top border ╤
      start: { x: opts.xStart - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
      end: { x: x - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
      thickness: this.settings.borderThickness,
      color: this.settings.borderColor
    })
    this.currentPage.drawLine({
      // right border ╢
      start: { x: x - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
      end: { x: x - this.settings.borderThickness, y: y + opts.cellHeight - this.settings.borderThickness },
      thickness: this.settings.borderThickness,
      color: this.settings.borderColor
    })
    return y
  }
}
