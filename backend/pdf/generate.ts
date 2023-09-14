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
import Travel from '../models/travel.js'
import DocumentFile from '../models/documentFile.js'
import mongoose, { mongo } from 'mongoose'
import {
  Cost,
  CountrySimple,
  TravelExpense,
  DocumentFile as IDocumentFile,
  Travel as ITravel,
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

export async function test() {
  await mongoose.connect(process.env.MONGO_URL, {})
  const travel = await Travel.findOne({ historic: false }).lean()
  if (travel) {
    await generateAndWriteToDisk('output.pdf', travel)
  }
  mongoose.disconnect()
}

export async function generateAndWriteToDisk(filePath: fs.PathOrFileDescriptor, travel: ITravel) {
  fs.writeFile(filePath, await generateReport(travel), () => null)
}

interface Options {
  font: pdf_lib.PDFFont
  fontSize: number
  xStart: number
  yStart: number
  textColor?: pdf_lib.Color
  edge?: number
}

interface TabelOptions extends Options {
  cellHeight?: number
  defaultCellWidth?: number
  borderThickness?: number
  textPadding?: { x: number; bottom: number }
  newPageXStart?: number
  newPageYStart?: number
  minimumY?: number
  borderColor?: pdf_lib.Color
  textColor?: pdf_lib.Color
  firstRow?: boolean
}

interface Column {
  key: string
  width: number
  alignment: pdf_lib.TextAlignment
  title: string
  fn?: (p: any) => string
  pseudoSuffix?: string
  cb?: Function
  cbValue?: (p: any) => any
}
interface ReceiptMapEntry extends IDocumentFile {
  number: number
  date: Date
}
interface ReceiptMap {
  [key: string]: ReceiptMapEntry
}

export async function generateReport(travel: ITravel) {
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
  const receiptMap = getReceiptMap(travel)

  y = drawSummary(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 10 })
  y = drawStages(getLastPage(), newPage, travel, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })
  y = drawExpenses(getLastPage(), newPage, travel, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })
  y = drawDays(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })

  await attachReceipts(pdfDoc, receiptMap, { font: font, edge: edge / 2, fontSize: 16 })

  return await pdfDoc.save()
}

function drawGeneralTravelInformation(page: pdf_lib.PDFPage, travel: ITravel, options: Options) {
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
    i18n.t('labels.traveler') + ': ' + travel.traveler.name + (travel.claimSpouseRefund ? ' & ' + travel.fellowTravelersNames : ''),
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

  // Dates + professionalShare
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
  page.drawText(text, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })
  return y
}

function getReceiptMap(travel: ITravel) {
  const map: ReceiptMap = {}
  var number = 1
  for (const stage of travel.stages) {
    if (stage.cost && stage.cost.receipts) {
      for (const receipt of stage.cost.receipts) {
        map[receipt._id!.toString()] = Object.assign({ number: number++, date: stage.cost.date as Date }, receipt)
      }
    }
  }

  for (const expense of travel.expenses) {
    if (expense.cost && expense.cost.receipts) {
      for (const receipt of expense.cost.receipts) {
        map[receipt._id!.toString()] = Object.assign({ number: number++, date: expense.cost.date as Date }, receipt)
      }
    }
  }
  return map
}

function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: ITravel, options: Options) {
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

function drawStages(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: ITravel, receiptMap: ReceiptMap, options: Options) {
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
    fn: (t: Transport) => i18n.t('labels.' + t)
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

function drawExpenses(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: ITravel, receiptMap: ReceiptMap, options: Options) {
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

function drawDays(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: ITravel, options: Options) {
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

async function attachReceipts(pdfDoc: pdf_lib.PDFDocument, receiptMap: ReceiptMap, options: Omit<Options, 'xStart' | 'yStart'>) {
  const opts = Object.assign(
    {
      fontSize: 16,
      textColor: pdf_lib.rgb(0, 0, 0),
      edge: 36
    },
    options
  )

  function drawNumber(page: pdf_lib.PDFPage, receipt: ReceiptMapEntry) {
    const text = '#' + receipt.number + ' - ' + datetoDateStringWithYear(receipt.date)
    const width = opts.font.widthOfTextAtSize(text, opts.fontSize)
    page.drawRectangle({
      x: 2,
      y: page.getSize().height - (opts.fontSize + 2),
      width: width,
      height: opts.fontSize + 2,
      color: pdf_lib.rgb(1, 1, 1),
      opacity: 0.5
    })
    page.drawText(text, {
      x: 2,
      y: page.getSize().height - (opts.fontSize + 2),
      size: opts.fontSize,
      font: opts.font,
      color: opts.textColor
    })
  }
  for (const receiptId in receiptMap) {
    const receipt = receiptMap[receiptId]
    const data = ((await DocumentFile.findOne({ _id: receipt._id }).lean())!.data as any as mongo.Binary).buffer
    if (receipt.type == 'application/pdf') {
      const insertPDF = await pdf_lib.PDFDocument.load(data)
      const pages = await pdfDoc.copyPages(insertPDF, insertPDF.getPageIndices())
      for (const p of pages) {
        const page = pdfDoc.addPage(p)
        drawNumber(page, receipt)
      }
    } else {
      if (receipt.type === 'image/jpeg') {
        const zeroOffsetData = new Uint8Array(data, 0)
        var image = await pdfDoc.embedJpg(zeroOffsetData)
      } else {
        // receipt.type === 'image/png'
        var image = await pdfDoc.embedPng(data)
      }
      var page = null
      if (image.width > image.height) {
        page = pdfDoc.addPage([pdf_lib.PageSizes.A4[1], pdf_lib.PageSizes.A4[0]]) // landscape page
      } else {
        page = pdfDoc.addPage(pdf_lib.PageSizes.A4)
      }
      var size = image.scaleToFit(page.getSize().width - opts.edge * 2, page.getSize().height - opts.edge * 2)
      if (size.width > image.width) {
        size = image.size()
      }
      page.drawImage(image, {
        x: (page.getSize().width - size.width) / 2,
        y: (page.getSize().height - size.height) / 2,
        width: size.width,
        height: size.height
      })
      drawNumber(page, receipt)
    }
  }
}

async function drawPlace(page: pdf_lib.PDFPage, place: Place, options: Options) {
  const opts = Object.assign(
    {
      textColor: pdf_lib.rgb(0, 0, 0),
      prefix: ''
    },
    options
  )

  const text = opts.prefix + place.place + ', ' + place.country.name[i18n.language as Locale]
  const flagX = opts.xStart + opts.font.widthOfTextAtSize(text, opts.fontSize) + opts.fontSize / 4

  page.drawText(text, {
    x: opts.xStart,
    y: opts.yStart,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  opts.xStart = flagX
  drawFlag(page, place.country._id, opts)
}

async function drawFlag(page: pdf_lib.PDFPage, countryCode: string, options: Options) {
  const opts = options

  var filename = countryCode
  if (opts.fontSize > 42 * 0.75) {
    // 0.75 px <=> 1 pt
    filename = filename + '@3x'
  } else if (opts.fontSize > 21 * 0.75) {
    // 0.75 px <=> 1 pt
    filename = filename + '@2x'
  }
  const flagBytes = fs.readFileSync('./pdf/flags/' + filename + '.png')
  const flag = await page.doc.embedPng(flagBytes)

  page.drawImage(flag, {
    x: opts.xStart,
    y: opts.yStart - opts.fontSize / 9,
    height: opts.fontSize,
    width: opts.fontSize * (3 / 2)
  })
}

async function drawLogo(page: pdf_lib.PDFPage, options: Options) {
  const opts = Object.assign({ textColor: pdf_lib.rgb(0, 0, 0), prefix: '' }, options)

  const text = i18n.t('headlines.title')
  const flagX = opts.xStart + opts.font.widthOfTextAtSize(text, opts.fontSize) + opts.fontSize / 4

  page.drawText(text, {
    x: opts.xStart,
    y: opts.yStart,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  var filename = 'airplane'
  if (opts.fontSize > 24) {
    filename = filename + '36'
  } else if (opts.fontSize > 12) {
    filename = filename + '24'
  } else {
    filename = filename + '12'
  }
  const logoBytes = fs.readFileSync('./pdf/airplanes/' + filename + '.png')
  const logo = await page.doc.embedPng(logoBytes)

  page.drawImage(logo, {
    x: flagX,
    y: opts.yStart - opts.fontSize / 9,
    height: opts.fontSize,
    width: opts.fontSize
  })
}

function drawTable(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, data: any[], columns: Column[], options: TabelOptions) {
  if (data.length < 0) {
    return options.yStart
  }
  const edge = options.edge ? options.edge : 36
  const fontSize = options.fontSize ? options.fontSize : 11
  const cellHeight = options.cellHeight ? options.cellHeight : fontSize * 1.5
  const opts = Object.assign(
    {
      edge: edge,
      fontSize: fontSize,
      cellHeight: cellHeight,
      defaultCellWidth: 100,
      borderThickness: 1,
      textPadding: { x: 2, bottom: 4 },
      xStart: edge,
      yStart: page.getSize().height - edge,
      newPageXStart: edge,
      newPageYStart: page.getSize().height - edge,
      minimumY: edge,
      borderColor: pdf_lib.rgb(0, 0, 0),
      textColor: pdf_lib.rgb(0, 0, 0),
      firstRow: true
    },
    options
  )

  if (!columns) {
    columns = []
    for (const key in data[0]) {
      columns.push({ key: key, width: opts.defaultCellWidth, alignment: pdf_lib.TextAlignment.Left, title: key })
    }
  }

  opts.yStart = opts.yStart - opts.cellHeight
  opts.newPageYStart = opts.newPageYStart - opts.cellHeight

  var x = opts.xStart
  var y = opts.yStart
  for (var i = 0; i < data.length; i++) {
    x = opts.xStart
    var yMin = y
    const columnBorders: pdf_lib.PDFPageDrawLineOptions[] = []
    const cellTexts: {
      text: string
      options: {
        x: number
        y: number
        width: number
        size: number
        font: pdf_lib.PDFFont
        color: pdf_lib.Color
      }
      pseudoSuffixWidth?: number
      cb?: Function
      cbValue?: (p: any) => any
    }[] = []
    for (const column of columns) {
      const datum = data[i][column.key]
      var cell = datum
      if (column.fn) {
        cell = column.fn(cell)
      }
      if (opts.firstRow) {
        cell = column.title
      }
      if (cell == undefined) {
        cell = '---'
      }
      const fontSize = opts.firstRow ? opts.fontSize + 1 : opts.fontSize
      const multiText = pdf_lib.layoutMultilineText(cell.toString() + (column.pseudoSuffix && !opts.firstRow ? column.pseudoSuffix : ''), {
        alignment: opts.firstRow ? pdf_lib.TextAlignment.Center : column.alignment,
        font: opts.font,
        fontSize: fontSize,
        bounds: {
          width: column.width - opts.textPadding.x * 3,
          height: fontSize,
          x: x,
          y: y
        }
      })
      for (const line of multiText.lines) {
        cellTexts.push({
          text: line.text,
          options: {
            x: line.x + opts.textPadding.x,
            y: line.y + opts.textPadding.bottom,
            width: line.width,
            size: fontSize,
            font: opts.font,
            color: opts.textColor
          }
        })
      }
      if (multiText.lines.length > 0 && !opts.firstRow) {
        if (column.pseudoSuffix) {
          cellTexts[cellTexts.length - 1].text = cellTexts[cellTexts.length - 1].text.slice(
            0,
            cellTexts[cellTexts.length - 1].text.length - column.pseudoSuffix.length
          )
          cellTexts[cellTexts.length - 1].pseudoSuffixWidth =
            opts.font.widthOfTextAtSize(column.pseudoSuffix, opts.fontSize) - opts.font.widthOfTextAtSize(' ', opts.fontSize)
        }
        cellTexts[cellTexts.length - 1].cb = column.cb
        if (column.cbValue) {
          cellTexts[cellTexts.length - 1].cbValue = column.cbValue(datum)
        }
      }

      columnBorders.push({
        // vertical border ╫
        start: { x: x - opts.borderThickness, y: y + opts.cellHeight - opts.borderThickness },
        end: { x: x - opts.borderThickness, y: 0 },
        thickness: opts.borderThickness,
        color: opts.borderColor
      })
      yMin = multiText.bounds.y < yMin ? multiText.bounds.y : yMin
      x = x + column.width
    }
    if (yMin < opts.minimumY) {
      page.drawLine({
        // top border ╤
        start: { x: opts.xStart - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
        end: { x: x - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
        thickness: opts.borderThickness,
        color: opts.borderColor
      })
      page.drawLine({
        // right border ╢
        start: { x: x - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
        end: { x: x - opts.borderThickness, y: y + opts.cellHeight - opts.borderThickness },
        thickness: opts.borderThickness,
        color: opts.borderColor
      })
      var page = newPageFn()
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
      page.drawText(text.text, text.options)
      if (text.cb) {
        text.pseudoSuffixWidth = text.pseudoSuffixWidth ? text.pseudoSuffixWidth : 0
        text.cb(page, text.cbValue, {
          yStart: text.options.y,
          xStart: text.options.x + text.options.width - text.pseudoSuffixWidth,
          fontSize: opts.fontSize
        })
      }
    }
    for (const border of columnBorders) {
      border.end.y = yMin - opts.borderThickness
      page.drawLine(border)
    }
    y = yMin
    page.drawLine({
      // horizontal border ╪
      start: { x: opts.xStart - opts.borderThickness, y: y - opts.borderThickness },
      end: { x: x - opts.borderThickness, y: y - opts.borderThickness },
      thickness: opts.borderThickness,
      color: opts.borderColor
    })
    y = y - opts.cellHeight
  }
  page.drawLine({
    // top border ╤
    start: { x: opts.xStart - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
    end: { x: x - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
    thickness: opts.borderThickness,
    color: opts.borderColor
  })
  page.drawLine({
    // right border ╢
    start: { x: x - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
    end: { x: x - opts.borderThickness, y: y + opts.cellHeight - opts.borderThickness },
    thickness: opts.borderThickness,
    color: opts.borderColor
  })
  return y
}
