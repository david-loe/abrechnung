import pdf_lib from 'pdf-lib'
import pdf_fontkit from 'pdf-fontkit'
import fs from 'fs'
import i18n from '../i18n.js'
import { getDetailedMoneyString, datetoDateStringWithYear, getExpenseReportTotal } from '../../common/scripts.js'
import { Cost, Locale, Money, ExpenseReport } from '../../common/types.js'
import { Column, Options, ReceiptMap, TabelOptions, drawTable, drawLogo, attachReceipts, getReceiptMap } from './helper.js'

export async function generateExpenseReportReport(expenseReport: ExpenseReport) {
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
  y = drawGeneralInformation(getLastPage(), expenseReport, { font: font, xStart: edge, yStart: y - 16, fontSize: fontSize })
  const receiptMap = getReceiptMap(expenseReport.expenses).map

  y = drawSummary(getLastPage(), newPage, expenseReport, { font: font, xStart: edge, yStart: y - 16, fontSize: 10 })
  y = drawExpenses(getLastPage(), newPage, expenseReport, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })

  await attachReceipts(pdfDoc, receiptMap, { font: font, edge: edge / 2, fontSize: 16 })

  return await pdfDoc.save()
}

function drawGeneralInformation(page: pdf_lib.PDFPage, expenseReport: ExpenseReport, options: Options) {
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
  page.drawText(expenseReport.name, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize * 1.5,
    font: opts.font,
    color: opts.textColor
  })

  // Traveler
  var y = y - opts.fontSize * 1.5 * 1.5
  page.drawText(i18n.t('labels.expensePayer') + ': ' + expenseReport.expensePayer.name, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  // Dates + professionalShare
  var text =
    i18n.t('labels.from') +
    ': ' +
    new Date(expenseReport.expenses[0].cost.date).toLocaleDateString(i18n.language) +
    '    ' +
    i18n.t('labels.to') +
    ': ' +
    new Date(expenseReport.expenses[expenseReport.expenses.length - 1].cost.date).toLocaleDateString(i18n.language)
  var y = y - opts.fontSize * 1.5
  page.drawText(text, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })
  return y
}

function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, expenseReport: ExpenseReport, options: Options) {
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
  summary.push({ reference: i18n.t('labels.total'), sum: getExpenseReportTotal(expenseReport) })

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
  expenseReport: ExpenseReport,
  receiptMap: ReceiptMap,
  options: Options
) {
  if (expenseReport.expenses.length == 0) {
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

  return drawTable(page, newPageFn, expenseReport.expenses, columns, options)
}
