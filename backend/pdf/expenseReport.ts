import fs from 'fs/promises'
import pdf_fontkit from 'pdf-fontkit'
import pdf_lib from 'pdf-lib'
import { addUp } from '../../common/scripts.js'
import { Cost, ExpenseReport, Locale, Money } from '../../common/types.js'
import { getSubmissionReportFromHistory } from '../helper.js'
import i18n, { formatter } from '../i18n.js'
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

export async function generateExpenseReportReport(expenseReport: ExpenseReport, language: Locale) {
  formatter.setLocale(language)
  const pdfDoc = await pdf_lib.PDFDocument.create()
  pdfDoc.registerFontkit(pdf_fontkit)
  const fontBytes = await fs.readFile('../common/fonts/NotoSans-Regular.ttf')
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

  let y = getLastPage().getSize().height
  await drawLogo(getLastPage(), { font: font, fontSize: 16, xStart: 16, yStart: y - 32, language, formatter })
  await drawOrganisationLogo(getLastPage(), expenseReport.project.organisation, {
    xStart: getLastPage().getSize().width - 166,
    yStart: y - 66,
    maxHeight: 50,
    maxWidth: 150
  })

  y = y - edge
  y = drawGeneralInformation(getLastPage(), expenseReport, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: fontSize,
    language,
    formatter
  })
  const receiptMap = getReceiptMap(expenseReport.expenses).map
  let yDates = await drawDates(getLastPage(), newPage, expenseReport, {
    font: font,
    xStart: getLastPage().getSize().width - edge - 175, // 175: width of dates table
    yStart: y - 16,
    fontSize: 9,
    language,
    formatter
  })
  y = await drawSummary(getLastPage(), newPage, expenseReport, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: 10,
    language,
    formatter
  })
  y = y < yDates ? y : yDates
  y = await drawExpenses(getLastPage(), newPage, expenseReport, receiptMap, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: 9,
    language,
    formatter
  })

  await attachReceipts(pdfDoc, receiptMap, { font: font, edge: edge / 2, fontSize: 16, language, formatter })

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
  let y = opts.yStart - opts.fontSize * 1.5
  page.drawText(expenseReport.name, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize * 1.5,
    font: opts.font,
    color: opts.textColor
  })
  //Project identifier and name
  y = y - opts.fontSize * 1.5
  page.drawText(
    i18n.t('labels.project', { lng: opts.language }) +
      ': ' +
      expenseReport.project.identifier +
      (expenseReport.project.name ? ' - ' + expenseReport.project.name : ''),
    {
      x: opts.xStart,
      y: y,
      size: opts.fontSize,
      font: opts.font,
      color: opts.textColor
    }
  )
  // Traveler
  y = y - opts.fontSize * 1.5 * 1.5
  page.drawText(
    i18n.t('labels.expensePayer', { lng: opts.language }) +
      ': ' +
      expenseReport.owner.name.givenName +
      ' ' +
      expenseReport.owner.name.familyName,
    {
      x: opts.xStart,
      y: y,
      size: opts.fontSize,
      font: opts.font,
      color: opts.textColor
    }
  )

  // Dates + professionalShare
  let text =
    i18n.t('labels.from', { lng: opts.language }) +
    ': ' +
    options.formatter.date(expenseReport.expenses[0].cost.date) +
    '    ' +
    i18n.t('labels.to', { lng: opts.language }) +
    ': ' +
    options.formatter.date(expenseReport.expenses[expenseReport.expenses.length - 1].cost.date)
  y = y - opts.fontSize * 1.5
  page.drawText(text, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  return y
}

async function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, expenseReport: ExpenseReport, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 100, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'sum',
    width: 65,
    alignment: pdf_lib.TextAlignment.Right,
    title: 'sum',
    fn: (m: Money) => options.formatter.detailedMoney(m, true)
  })

  const addedUp = addUp(expenseReport)
  const summary = []
  if (addedUp.advance.amount !== null && addedUp.advance.amount > 0) {
    summary.push({ reference: i18n.t('labels.expenses', { lng: options.language }), sum: addedUp.expenses })
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

async function drawDates(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, expenseReport: ExpenseReport, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 80, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'value',
    width: 95,
    alignment: pdf_lib.TextAlignment.Left,
    title: 'value',
    fn: (d: Date | string) => (typeof d === 'string' ? d : options.formatter.date(d))
  })

  const summary = []
  summary.push({
    reference: i18n.t('labels.submittedOn', { lng: options.language }),
    value: (await getSubmissionReportFromHistory(expenseReport))?.updatedAt
  })
  summary.push({ reference: i18n.t('labels.examinedOn', { lng: options.language }), value: expenseReport.updatedAt })
  summary.push({
    reference: i18n.t('labels.examinedBy', { lng: options.language }),
    value: expenseReport.editor.name.givenName + ' ' + expenseReport.editor.name.familyName
  })
  const tabelOptions: TabelOptions = options
  tabelOptions.firstRow = false

  return await drawTable(page, newPageFn, summary, columns, tabelOptions)
}

async function drawExpenses(
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

  return await drawTable(page, newPageFn, expenseReport.expenses, columns, options)
}
