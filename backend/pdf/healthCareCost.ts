import fs from 'fs'
import pdf_fontkit from 'pdf-fontkit'
import pdf_lib from 'pdf-lib'
import Formatter from '../../common/formatter.js'
import { addUp } from '../../common/scripts.js'
import { Cost, HealthCareCost, Locale, Money } from '../../common/types.js'
import { getDateOfSubmission } from '../helper.js'
import i18n from '../i18n.js'
import {
  Column,
  Options,
  ReceiptMap,
  TabelOptions,
  attachReceipts,
  drawLogo,
  drawOrganisationLogo,
  drawTable,
  getReceiptMap
} from './helper.js'

export async function generateHealthCareCostReport(healthCareCost: HealthCareCost, language: Locale) {
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
  await drawOrganisationLogo(getLastPage(), healthCareCost.project.organisation, {
    xStart: getLastPage().getSize().width - 166,
    yStart: y - 66,
    maxHeight: 50,
    maxWidth: 150
  })
  y = y - edge
  y = drawGeneralInformation(getLastPage(), healthCareCost, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: fontSize,
    language,
    formatter
  })
  const receiptMap = getReceiptMap(healthCareCost.expenses).map
  let yDates = await drawDates(getLastPage(), newPage, healthCareCost, {
    font: font,
    xStart: getLastPage().getSize().width - edge - 135, // 135: width of dates table
    yStart: y - 16,
    fontSize: 9,
    language,
    formatter
  })
  y = await drawSummary(getLastPage(), newPage, healthCareCost, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: 10,
    language,
    formatter
  })
  y = y < yDates ? y : yDates
  y = await drawExpenses(getLastPage(), newPage, healthCareCost, receiptMap, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: 9,
    language,
    formatter
  })

  const confirmReceiptsMap: ReceiptMap = {}
  if (healthCareCost.refundSum.receipts && healthCareCost.refundSum.receipts.length > 0) {
    for (const receipt of healthCareCost.refundSum.receipts) {
      confirmReceiptsMap[receipt._id!.toString()] = Object.assign({ number: 0, date: new Date(), noNumberPrint: true }, receipt)
    }
  }

  await attachReceipts(pdfDoc, Object.assign(confirmReceiptsMap, receiptMap), {
    font: font,
    edge: edge / 2,
    fontSize: 16,
    language,
    formatter
  })
  return await pdfDoc.save()
}

function drawGeneralInformation(page: pdf_lib.PDFPage, healthCareCost: HealthCareCost, options: Options) {
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
  page.drawText(healthCareCost.name, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize * 1.5,
    font: opts.font,
    color: opts.textColor
  })

  // Isurance + patientName
  var y = y - opts.fontSize * 1.5 * 1.5
  page.drawText(
    i18n.t('labels.insurance', { lng: opts.language }) +
      ': ' +
      healthCareCost.insurance.name +
      '      ' +
      i18n.t('labels.applicant', { lng: opts.language }) +
      ': ' +
      healthCareCost.owner.name.givenName +
      ' ' +
      healthCareCost.owner.name.familyName +
      '      ' +
      i18n.t('labels.patientName', { lng: opts.language }) +
      ': ' +
      healthCareCost.patientName,
    {
      x: opts.xStart,
      y: y,
      size: opts.fontSize,
      font: opts.font,
      color: opts.textColor
    }
  )

  //Project identifier and name
  var y = y - opts.fontSize * 1.5
  page.drawText(
    i18n.t('labels.project', { lng: opts.language }) +
      ': ' +
      healthCareCost.project.identifier +
      ' - ' +
      (healthCareCost.project.name ? healthCareCost.project.name : ''),
    {
      x: opts.xStart,
      y: y,
      size: opts.fontSize,
      font: opts.font,
      color: opts.textColor
    }
  )

  return y
}

async function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, healthCareCost: HealthCareCost, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 200, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'sum',
    width: 85,
    alignment: pdf_lib.TextAlignment.Right,
    title: 'sum',
    fn: (m: Money) => options.formatter.detailedMoney(m, true)
  })

  const addedUp = addUp(healthCareCost)
  const summary = []
  summary.push({ reference: i18n.t('labels.total', { lng: options.language }), sum: addedUp.total })
  if (healthCareCost.state === 'refunded') {
    summary.push({ reference: i18n.t('labels.refundSum', { lng: options.language }), sum: healthCareCost.refundSum })
  }

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

async function drawDates(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, healthCareCost: HealthCareCost, options: Options) {
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
  summary.push({ reference: i18n.t('labels.submittedOn', { lng: options.language }), date: await getDateOfSubmission(healthCareCost) })
  summary.push({ reference: i18n.t('labels.examinedOn', { lng: options.language }), date: healthCareCost.updatedAt })

  const tabelOptions: TabelOptions = options
  tabelOptions.firstRow = false

  return await drawTable(page, newPageFn, summary, columns, tabelOptions)
}

async function drawExpenses(
  page: pdf_lib.PDFPage,
  newPageFn: () => pdf_lib.PDFPage,
  healthCareCost: HealthCareCost,
  receiptMap: ReceiptMap,
  options: Options
) {
  if (healthCareCost.expenses.length == 0) {
    return options.yStart
  }
  const columns: Column[] = []
  columns.push({
    key: 'description',
    width: 300,
    alignment: pdf_lib.TextAlignment.Left,
    title: i18n.t('labels.description', { lng: options.language })
  })
  columns.push({
    key: 'cost',
    width: 160,
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

  return await drawTable(page, newPageFn, healthCareCost.expenses, columns, options)
}
