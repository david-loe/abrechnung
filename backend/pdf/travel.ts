import fs from 'fs'
import pdf_fontkit from 'pdf-fontkit'
import pdf_lib from 'pdf-lib'
import Formatter from '../../common/formatter.js'
import { addUp } from '../../common/scripts.js'
import {
  Cost,
  CountrySimple,
  Locale,
  Meal,
  Money,
  Place,
  Purpose,
  PurposeSimple,
  Refund,
  Transport,
  Travel,
  TravelDay,
  TravelExpense,
  baseCurrency
} from '../../common/types.js'
import { getDateOfSubmission, getSettings } from '../helper.js'
import i18n from '../i18n.js'
import {
  Column,
  Options,
  ReceiptMap,
  TabelOptions,
  attachReceipts,
  drawFlag,
  drawLogo,
  drawOrganisationLogo,
  drawPlace,
  drawTable,
  getReceiptMap
} from './helper.js'

export async function generateTravelReport(travel: Travel, language: Locale) {
  const formatter = new Formatter(language)
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
  await drawLogo(getLastPage(), { font: font, fontSize: 16, xStart: 16, yStart: y - 32, language, formatter })
  await drawOrganisationLogo(getLastPage(), travel.project.organisation, {
    xStart: getLastPage().getSize().width - 166,
    yStart: y - 66,
    maxHeight: 50,
    maxWidth: 150
  })
  y = y - edge
  y = drawGeneralTravelInformation(getLastPage(), travel, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: fontSize,
    language,
    formatter
  })

  const result = getReceiptMap(travel.stages)
  const receiptMap = Object.assign(result.map, getReceiptMap(travel.expenses, result.number).map)

  let yDates = await drawDates(getLastPage(), newPage, travel, {
    font: font,
    xStart: getLastPage().getSize().width - edge - 135, // 135: width of dates table
    yStart: y - 16,
    fontSize: 9,
    language,
    formatter
  })
  y = await drawSummary(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 10, language, formatter })
  y = y < yDates ? y : yDates
  y = await drawStages(getLastPage(), newPage, travel, receiptMap, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: 9,
    language,
    formatter
  })
  y = await drawExpenses(getLastPage(), newPage, travel, receiptMap, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: 9,
    language,
    formatter
  })
  y = await drawDays(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 9, language, formatter })

  await attachReceipts(pdfDoc, receiptMap, { font: font, edge: edge / 2, fontSize: 16, language, formatter })

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
  //Project identifier and name
  var y = y - opts.fontSize * 1.5
  page.drawText(
    i18n.t('labels.project', { lng: opts.language }) +
      ': ' +
      travel.project.identifier +
      (travel.project.name ? ' - ' + travel.project.name : ''),
    {
      x: opts.xStart,
      y: y,
      size: opts.fontSize,
      font: opts.font,
      color: opts.textColor
    }
  )
  // Traveler
  var y = y - opts.fontSize * 1.5 * 1.5
  page.drawText(
    i18n.t('labels.traveler', { lng: opts.language }) +
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
      prefix:
        i18n.t('labels.reason', { lng: opts.language }) +
        ': ' +
        travel.reason +
        '    ' +
        i18n.t('labels.destinationPlace', { lng: opts.language }) +
        ': '
    })
  )

  // Dates + professionalShare + lastPlaceOfWork
  var text =
    i18n.t('labels.from', { lng: opts.language }) +
    ': ' +
    options.formatter.date(travel.startDate) +
    '    ' +
    i18n.t('labels.to', { lng: opts.language }) +
    ': ' +
    options.formatter.date(travel.endDate)
  if (travel.professionalShare !== 1) {
    text =
      text + '    ' + i18n.t('labels.professionalShare', { lng: opts.language }) + ': ' + Math.round(travel.professionalShare! * 100) + '%'
  }
  const lastPlace = { country: travel.lastPlaceOfWork.country, place: travel.lastPlaceOfWork.special }
  var y = y - opts.fontSize * 1.5
  drawPlace(
    page,
    lastPlace,
    Object.assign(opts, {
      yStart: y,
      prefix: text + '    ' + i18n.t('labels.lastPlaceOfWork', { lng: opts.language }) + ': '
    })
  )
  return y
}

async function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: Travel, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 100, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'sum',
    width: 65,
    alignment: pdf_lib.TextAlignment.Right,
    title: 'sum',
    fn: (m: Money) => options.formatter.detailedMoney(m, true)
  })

  const addedUp = addUp(travel)
  const summary = []
  summary.push({ reference: i18n.t('labels.lumpSums', { lng: options.language }), sum: addedUp.lumpSums })
  summary.push({ reference: i18n.t('labels.expenses', { lng: options.language }), sum: addedUp.expenses })
  if (addedUp.advance.amount !== null && addedUp.advance.amount > 0) {
    addedUp.advance.amount = -1 * addedUp.advance.amount
    summary.push({ reference: i18n.t('labels.advance', { lng: options.language }), sum: addedUp.advance })
  }
  summary.push({ reference: i18n.t('labels.total', { lng: options.language }), sum: addedUp.total })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.summary', { lng: options.language }), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  const tabelOptions: TabelOptions = options
  tabelOptions.yStart -= fontSize * 1.25
  tabelOptions.firstRow = false

  return await drawTable(page, newPageFn, summary, columns, tabelOptions)
}

async function drawDates(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: Travel, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 80, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'date',
    width: 55,
    alignment: pdf_lib.TextAlignment.Right,
    title: 'date',
    fn: (d: Date) => options.formatter.date(d)
  })

  const summary = []
  summary.push({ reference: i18n.t('labels.appliedForOn', { lng: options.language }), date: travel.createdAt })
  summary.push({
    reference: i18n.t('labels.approvedOn', { lng: options.language }),
    date: (await getDateOfSubmission(travel, 'appliedFor')) || travel.createdAt
  })
  summary.push({ reference: i18n.t('labels.submittedOn', { lng: options.language }), date: await getDateOfSubmission(travel) })
  summary.push({ reference: i18n.t('labels.examinedOn', { lng: options.language }), date: travel.updatedAt })

  const tabelOptions: TabelOptions = options
  tabelOptions.firstRow = false

  return await drawTable(page, newPageFn, summary, columns, tabelOptions)
}

async function drawStages(
  page: pdf_lib.PDFPage,
  newPageFn: () => pdf_lib.PDFPage,
  travel: Travel,
  receiptMap: ReceiptMap,
  options: Options
) {
  const settings = await getSettings()
  if (travel.stages.length == 0) {
    return options.yStart
  }
  const columns: Column[] = []
  columns.push({
    key: 'departure',
    width: 45,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.departure', { lng: options.language }),
    fn: (d: Date) => options.formatter.simpleDateTime(d)
  })
  columns.push({
    key: 'arrival',
    width: 45,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.arrival', { lng: options.language }),
    fn: (d: Date) => options.formatter.simpleDateTime(d)
  })
  columns.push({
    key: 'startLocation',
    width: 145,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.startLocation', { lng: options.language }),
    fn: (p: Place) => p.place + ', ' + p.country.name[options.language],
    pseudoSuffix: 'mim',
    cb: drawFlag,
    cbValue: (p: Place) => p.country._id
  })
  columns.push({
    key: 'endLocation',
    width: 145,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.endLocation', { lng: options.language }),
    fn: (p: Place) => p.place + ', ' + p.country.name[options.language],
    pseudoSuffix: 'mim',
    cb: drawFlag,
    cbValue: (p: Place) => p.country._id
  })
  columns.push({
    key: 'transport',
    width: 90,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.transport', { lng: options.language }),
    fn: (t: Transport) =>
      t.type === 'ownCar'
        ? i18n.t('distanceRefundTypes.' + t.distanceRefundType, { lng: options.language }) +
          ' (' +
          settings.travelSettings.distanceRefunds[t.distanceRefundType] +
          ' ' +
          baseCurrency.symbol +
          '/km)'
        : i18n.t('labels.' + t.type, { lng: options.language })
  })
  columns.push({
    key: 'distance',
    width: 65,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('labels.distance', { lng: options.language })
  })
  columns.push({
    key: 'purpose',
    width: 50,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.purpose', { lng: options.language }),
    fn: (p: Purpose) =>
      i18n.t('labels.' + p, { lng: options.language }) + (p === 'mixed' ? ' (' + Math.round(travel.professionalShare! * 100) + '%)' : '')
  })
  columns.push({
    key: 'cost',
    width: 80,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('labels.cost', { lng: options.language }),
    fn: (m: Cost) => options.formatter.detailedMoney(m)
  })
  columns.push({
    key: 'note',
    width: 70,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.note', { lng: options.language })
  })
  columns.push({
    key: 'cost',
    width: 45,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.receiptNumber', { lng: options.language }),
    fn: (m: Cost) => m.receipts.map((r) => receiptMap[r._id!.toString()].number).join(', ')
  })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.stages', { lng: options.language }), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  options.yStart -= fontSize * 1.25

  return await drawTable(page, newPageFn, travel.stages, columns, options)
}

async function drawExpenses(
  page: pdf_lib.PDFPage,
  newPageFn: () => pdf_lib.PDFPage,
  travel: Travel,
  receiptMap: ReceiptMap,
  options: Options
) {
  if (travel.expenses.length == 0) {
    return options.yStart
  }
  const columns: Column[] = []
  columns.push({
    key: 'description',
    width: 270,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.description', { lng: options.language })
  })
  columns.push({
    key: 'purpose',
    width: 50,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.purpose', { lng: options.language }),
    fn: (p: TravelExpense['purpose']) =>
      i18n.t('labels.' + p, { lng: options.language }) + (p === 'mixed' ? ' (' + Math.round(travel.professionalShare! * 100) + '%)' : '')
  })
  columns.push({
    key: 'cost',
    width: 90,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('labels.cost', { lng: options.language }),
    fn: (m: Cost) => options.formatter.detailedMoney(m)
  })
  columns.push({
    key: 'cost',
    width: 90,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.invoiceDate', { lng: options.language }),
    fn: (c: Cost) => options.formatter.date(c.date)
  })
  columns.push({
    key: 'note',
    width: 130,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.note', { lng: options.language })
  })
  columns.push({
    key: 'cost',
    width: 45,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.receiptNumber', { lng: options.language }),
    fn: (m: Cost) => m.receipts.map((r) => receiptMap[r._id!.toString()].number).join(', ')
  })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.expenses', { lng: options.language }), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  options.yStart -= fontSize * 1.25

  return await drawTable(page, newPageFn, travel.expenses, columns, options)
}

async function drawDays(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: Travel, options: Options) {
  if (travel.days.length == 0) {
    return options.yStart
  }
  const columns = []
  columns.push({
    key: 'date',
    width: 70,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.date', { lng: options.language }),
    fn: (d: Date) => options.formatter.date(d)
  })
  columns.push({
    key: 'country',
    width: 120,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.country', { lng: options.language }),
    fn: (c: CountrySimple) => c.name[options.language],
    pseudoSuffix: 'mim',
    cb: drawFlag,
    cbValue: (c: CountrySimple) => c._id
  })
  columns.push({
    key: 'special',
    width: 80,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.city', { lng: options.language }),
    fn: (s?: string) => (s ? s : '')
  })
  columns.push({
    key: 'purpose',
    width: 50,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.purpose', { lng: options.language }),
    fn: (p: PurposeSimple) => i18n.t('labels.' + p, { lng: options.language })
  })
  columns.push({
    key: 'cateringNoRefund',
    width: 80,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.cateringNoRefund', { lng: options.language }),
    fn: (c: TravelDay['cateringNoRefund']) =>
      (Object.keys(c) as Meal[]).map((k) => (c[k] ? i18n.t('labels.' + k, { lng: options.language }) : '')).join(' ')
  })
  columns.push({
    key: 'refunds',
    width: 80,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('lumpSums.catering24\n', { lng: options.language }),
    fn: (r: Refund[]) =>
      r.filter((r) => r.type.indexOf('catering') === 0).length > 0
        ? options.formatter.detailedMoney(r.filter((r) => r.type.indexOf('catering') === 0)[0].refund)
        : ''
  })
  columns.push({
    key: 'refunds',
    width: 80,
    alignment: pdf_lib.TextAlignment.Right,
    title: i18n.t('lumpSums.overnight\n', { lng: options.language }),
    fn: (r: Refund[]) =>
      r.filter((r) => r.type == 'overnight').length > 0
        ? options.formatter.detailedMoney(r.filter((r) => r.type == 'overnight')[0].refund)
        : ''
  })

  const fontSize = options.fontSize + 2
  page.drawText(
    i18n.t('labels.lumpSums', { lng: options.language }) +
      (travel.claimSpouseRefund ? ' (' + i18n.t('labels.claimSpouseRefund', { lng: options.language }) + ')' : ''),
    {
      x: options.xStart,
      y: options.yStart - fontSize,
      size: fontSize,
      font: options.font,
      color: options.textColor
    }
  )
  options.yStart -= fontSize * 1.25

  return await drawTable(page, newPageFn, travel.days, columns, options)
}
