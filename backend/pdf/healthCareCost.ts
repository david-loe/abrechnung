import pdf_lib from 'pdf-lib'
import pdf_fontkit from 'pdf-fontkit'
import fs from 'fs'
import i18n from '../i18n.js'
import { getDetailedMoneyString, datetoDateStringWithYear, getHealthCareCostTotal } from '../../common/scripts.js'
import { Cost, Locale, Money, HealthCareCost } from '../../common/types.js'
import { Column, Options, ReceiptMap, TabelOptions, drawTable, drawLogo, attachReceipts, getReceiptMap } from './helper.js'

export async function generateHealthCareCostReport(healthCareCost: HealthCareCost) {
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
  y = drawGeneralInformation(getLastPage(), healthCareCost, { font: font, xStart: edge, yStart: y - 16, fontSize: fontSize })
  const receiptMap = getReceiptMap(healthCareCost.expenses).map

  y = drawSummary(getLastPage(), newPage, healthCareCost, { font: font, xStart: edge, yStart: y - 16, fontSize: 10 })
  y = drawExpenses(getLastPage(), newPage, healthCareCost, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })

  const confirmReceiptsMap: ReceiptMap = {}
  if (healthCareCost.refundSum.receipts && healthCareCost.refundSum.receipts.length > 0) {
    for (const receipt of healthCareCost.refundSum.receipts) {
      confirmReceiptsMap[receipt._id!.toString()] = Object.assign({ number: 0, date: new Date(), noNumberPrint: true }, receipt)
    }
  }

  await attachReceipts(pdfDoc, Object.assign(confirmReceiptsMap, receiptMap), { font: font, edge: edge / 2, fontSize: 16 })
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
    i18n.t('labels.insurance') +
      ': ' +
      healthCareCost.insurance +
      '      ' +
      i18n.t('labels.applicant') +
      ': ' +
      healthCareCost.applicant.name.givenName +
      ' ' +
      healthCareCost.applicant.name.familyName +
      '      ' +
      i18n.t('labels.patientName') +
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

  return y
}

function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, healthCareCost: HealthCareCost, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 200, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'sum',
    width: 85,
    alignment: pdf_lib.TextAlignment.Right,
    title: 'sum',
    fn: (m: Money) => getDetailedMoneyString(m, i18n.language as Locale, true)
  })

  const summary = []
  summary.push({ reference: i18n.t('labels.total'), sum: getHealthCareCostTotal(healthCareCost) })
  if (healthCareCost.state === 'refunded') {
    summary.push({ reference: i18n.t('labels.refundSum'), sum: healthCareCost.refundSum })
  }

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

function drawExpenses(
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
  columns.push({ key: 'description', width: 400, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.description') })
  columns.push({
    key: 'cost',
    width: 160,
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

  return drawTable(page, newPageFn, healthCareCost.expenses, columns, options)
}
