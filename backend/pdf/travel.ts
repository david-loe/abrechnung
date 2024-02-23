import pdf_lib from 'pdf-lib'
import pdf_fontkit from 'pdf-fontkit'
import fs from 'fs'
import i18n from '../i18n.js'
import {
  getDetailedMoneyString,
  getLumpSumsSum,
  getExpensesSum,
  getTravelTotal,
  dateTimeToString,
  datetoDateStringWithYear,
  datetoDateString
} from '../../common/scripts.js'
import {
  Cost,
  CountrySimple,
  TravelExpense,
  Travel,
  Locale,
  Meal,
  Money,
  Place,
  Purpose,
  PurposeSimple,
  Refund,
  Transport,
  TravelDay
} from '../../common/types.js'
import {
  Column,
  Options,
  ReceiptMap,
  TabelOptions,
  drawTable,
  drawFlag,
  drawLogo,
  attachReceipts,
  drawPlace,
  getReceiptMap
} from './helper.js'
import Settings from '../models/settings.js'

export async function generateTravelReport(travel: Travel) {
  const pdfDoc = await pdf_lib.PDFDocument.create()
  pdfDoc.registerFontkit(pdf_fontkit)
  const fontBytes = fs.readFileSync('../common/fonts/NotoSans-Regular.ttf')
  const font = await pdfDoc.embedFont(fontBytes, { subset: true })
  const edge = 36
  const fontSize = 11

  function newPage() {
    return pdfDoc.addPage([pdf_lib.PageSizes.A4[1], pdf_lib.PageSizes.A4[0]]) // landscape page
  }
  function getLastPage() {
    return pdfDoc.getPage(pdfDoc.getPageCount() - 1)
  }
  newPage()

  var y = getLastPage().getSize().height
  drawLogo(getLastPage(), { font: font, fontSize: 16, xStart: 16, yStart: y - 32 })
  y = y - edge
  y = drawGeneralTravelInformation(getLastPage(), travel, { font: font, xStart: edge, yStart: y - 16, fontSize: fontSize })

  const result = getReceiptMap(travel.stages)
  const receiptMap = Object.assign(result.map, getReceiptMap(travel.expenses, result.number).map)

  y = drawSummary(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 10 })
  y = await drawStages(getLastPage(), newPage, travel, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })
  y = drawExpenses(getLastPage(), newPage, travel, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })
  y = drawDays(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })

  await attachReceipts(pdfDoc, receiptMap, { font: font, edge: edge / 2, fontSize: 16 })

  return await pdfDoc.save()
}

function drawGeneralTravelInformation(page: pdf_lib.PDFPage, travel: Travel, options: Options) {
  const edge = options.edge ? options.edge : 36
  const opts = Object.assign(
    {
      xStart: edge,
      yStart: page.getSize().height - edge,
      textColor: pdf_lib.rgb(0, 0, 0)
    },
    options
  )

  // Title
  var y = opts.yStart - opts.fontSize * 1.5
  page.drawText(travel.name, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize * 1.5,
    font: opts.font,
    color: opts.textColor
  })

  // Traveler
  var y = y - opts.fontSize * 1.5 * 1.5
  page.drawText(
    i18n.t('labels.traveler') +
      ': ' +
      travel.owner.name.givenName +
      ' ' +
      travel.owner.name.familyName +
      (travel.claimSpouseRefund ? ' & ' + travel.fellowTravelersNames : ''),
    {
      x: opts.xStart,
      y: y,
      size: opts.fontSize,
      font: opts.font,
      color: opts.textColor
    }
  )

  // Reason + Place
  var y = y - opts.fontSize * 1.5
  drawPlace(
    page,
    travel.destinationPlace,
    Object.assign(opts, {
      yStart: y,
      prefix: i18n.t('labels.reason') + ': ' + travel.reason + '    ' + i18n.t('labels.destinationPlace') + ': '
    })
  )

  // Dates + professionalShare + lastPlaceOfWork
  var text =
    i18n.t('labels.from') +
    ': ' +
    new Date(travel.startDate).toLocaleDateString(i18n.language) +
    '    ' +
    i18n.t('labels.to') +
    ': ' +
    new Date(travel.endDate).toLocaleDateString(i18n.language)
  if (travel.professionalShare !== 1) {
    text = text + '    ' + i18n.t('labels.professionalShare') + ': ' + Math.round(travel.professionalShare! * 100) + '%'
  }

  var y = y - opts.fontSize * 1.5
  drawPlace(
    page,
    travel.lastPlaceOfWork,
    Object.assign(opts, {
      yStart: y,
      prefix: text + '    ' + i18n.t('labels.lastPlaceOfWork') + ': '
    })
  )
  return y
}

function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: Travel, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 100, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'sum',
    width: 65,
    alignment: pdf_lib.TextAlignment.Right,
    title: 'sum',
    fn: (m: Money) => getDetailedMoneyString(m, i18n.language as Locale, true)
  })

  const summary = []
  summary.push({ reference: i18n.t('labels.lumpSums'), sum: getLumpSumsSum(travel) })
  summary.push({ reference: i18n.t('labels.expenses'), sum: getExpensesSum(travel) })
  if (travel.advance.amount !== null && travel.advance.amount > 0) {
    travel.advance.amount = -1 * travel.advance.amount
    summary.push({ reference: i18n.t('labels.advance'), sum: travel.advance })
    travel.advance.amount = -1 * travel.advance.amount
  }
  summary.push({ reference: i18n.t('labels.total'), sum: getTravelTotal(travel) })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.summary'), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  const tabelOptions: TabelOptions = options
  tabelOptions.yStart -= fontSize * 1.25
  tabelOptions.firstRow = false

  return drawTable(page, newPageFn, summary, columns, tabelOptions)
}

async function drawStages(
  page: pdf_lib.PDFPage,
  newPageFn: () => pdf_lib.PDFPage,
  travel: Travel,
  receiptMap: ReceiptMap,
  options: Options
) {
  const settings = (await Settings.findOne().lean())!
  if (travel.stages.length == 0) {
    return options.yStart
  }
  const columns: Column[] = []
  columns.push({
    key: 'departure',
    width: 65,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.departure'),
    fn: (d: Date) => dateTimeToString(d)
  })
  columns.push({
    key: 'arrival',
    width: 65,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.arrival'),
    fn: (d: Date) => dateTimeToString(d)
  })
  columns.push({
    key: 'startLocation',
    width: 150,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.startLocation'),
    fn: (p: Place) => p.place + ', ' + p.country.name[i18n.language as Locale],
    pseudoSuffix: 'mim',
    cb: drawFlag,
    cbValue: (p: Place) => p.country._id
  })
  columns.push({
    key: 'endLocation',
    width: 150,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.endLocation'),
    fn: (p: Place) => p.place + ', ' + p.country.name[i18n.language as Locale],
    pseudoSuffix: 'mim',
    cb: drawFlag,
    cbValue: (p: Place) => p.country._id
  })
  columns.push({
    key: 'transport',
    width: 90,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.transport'),
    fn: (t: Transport) =>
      t.type === 'ownCar'
        ? i18n.t('distanceRefundTypes.' + t.distanceRefundType) +
          ' (' +
          settings.distanceRefunds[t.distanceRefundType] +
          ' ' +
          (settings.baseCurrency.symbol ? settings.baseCurrency.symbol : settings.baseCurrency._id) +
          '/km)'
        : i18n.t('labels.' + t.type)
  })
  columns.push({ key: 'distance', width: 65, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.distance') })
  columns.push({
    key: 'purpose',
    width: 50,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.purpose'),
    fn: (p: Purpose) => i18n.t('labels.' + p) + (p === 'mixed' ? ' (' + Math.round(travel.professionalShare! * 100) + '%)' : '')
  })
  columns.push({
    key: 'cost',
    width: 80,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('labels.cost'),
    fn: (m: Cost) => getDetailedMoneyString(m, i18n.language as Locale)
  })
  columns.push({
    key: 'cost',
    width: 35,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('labels.receiptNumber'),
    fn: (m: Cost) => m.receipts.map((r) => receiptMap[r._id!.toString()].number).join(', ')
  })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.stages'), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  options.yStart -= fontSize * 1.25

  return drawTable(page, newPageFn, travel.stages, columns, options)
}

function drawExpenses(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: Travel, receiptMap: ReceiptMap, options: Options) {
  if (travel.expenses.length == 0) {
    return options.yStart
  }
  const columns: Column[] = []
  columns.push({ key: 'description', width: 270, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.description') })
  columns.push({
    key: 'purpose',
    width: 50,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.purpose'),
    fn: (p: TravelExpense['purpose']) =>
      i18n.t('labels.' + p) + (p === 'mixed' ? ' (' + Math.round(travel.professionalShare! * 100) + '%)' : '')
  })
  columns.push({
    key: 'cost',
    width: 90,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('labels.cost'),
    fn: (m: Cost) => getDetailedMoneyString(m, i18n.language as Locale)
  })
  columns.push({
    key: 'cost',
    width: 90,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.invoiceDate'),
    fn: (c: Cost) => datetoDateStringWithYear(c.date)
  })
  columns.push({
    key: 'cost',
    width: 35,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.receiptNumber'),
    fn: (m: Cost) => m.receipts.map((r) => receiptMap[r._id!.toString()].number).join(', ')
  })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.expenses'), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  options.yStart -= fontSize * 1.25

  return drawTable(page, newPageFn, travel.expenses, columns, options)
}

function drawDays(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: Travel, options: Options) {
  if (travel.days.length == 0) {
    return options.yStart
  }
  const columns = []
  columns.push({
    key: 'date',
    width: 70,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.date'),
    fn: (d: Date) => datetoDateString(d)
  })
  columns.push({
    key: 'country',
    width: 120,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.country'),
    fn: (c: CountrySimple) => c.name[i18n.language as Locale],
    pseudoSuffix: 'mim',
    cb: drawFlag,
    cbValue: (c: CountrySimple) => c._id
  })
  columns.push({
    key: 'special',
    width: 80,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.city'),
    fn: (s?: string) => (s ? s : '')
  })
  columns.push({
    key: 'purpose',
    width: 50,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.purpose'),
    fn: (p: PurposeSimple) => i18n.t('labels.' + p)
  })
  columns.push({
    key: 'cateringNoRefund',
    width: 80,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.cateringNoRefund'),
    fn: (c: TravelDay['cateringNoRefund']) => (Object.keys(c) as Meal[]).map((k) => (c[k] ? i18n.t('labels.' + k) : '')).join(' ')
  })
  columns.push({
    key: 'refunds',
    width: 80,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('lumpSums.catering24\n'),
    fn: (r: Refund[]) =>
      r.filter((r) => r.type.indexOf('catering') === 0).length > 0
        ? getDetailedMoneyString(r.filter((r) => r.type.indexOf('catering') === 0)[0].refund, i18n.language as Locale)
        : ''
  })
  columns.push({
    key: 'refunds',
    width: 80,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('lumpSums.overnight\n'),
    fn: (r: Refund[]) =>
      r.filter((r) => r.type == 'overnight').length > 0
        ? getDetailedMoneyString(r.filter((r) => r.type == 'overnight')[0].refund, i18n.language as Locale)
        : ''
  })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.lumpSums') + (travel.claimSpouseRefund ? ' (' + i18n.t('labels.claimSpouseRefund') + ')' : ''), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  options.yStart -= fontSize * 1.25

  return drawTable(page, newPageFn, travel.days, columns, options)
}
