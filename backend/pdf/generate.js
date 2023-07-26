
const pdf_lib = require('pdf-lib')
const pdf_fontkit = require('pdf-fontkit')
const fs = require('fs')
const i18n = require('../i18n')
const scripts = require('../../common/scripts')
const Travel = require('../models/travel')
const DocumentFile = require('../models/documentFile')
const mongoose = require('mongoose')


async function test() {
  await mongoose.connect(process.env.MONGO_URL, {})
  const travel = await Travel.findOne({ historic: false })

  await generateAndWriteToDisk('output.pdf', travel)
  mongoose.disconnect()
}

async function generateAndWriteToDisk(filePath, travel) {
  fs.writeFile(filePath, await generateReport(travel), () => null);
}

async function generateReport(travel) {
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
  drawLogo(getLastPage(), { font: font, fontSize: 16, x: 16, y: y - 32 })
  y = y - edge
  y = drawGeneralTravelInformation(getLastPage(), travel, { font: font, xStart: edge, yStart: y - 16, fontSize: fontSize })
  const receiptMap = getReceiptMap(travel)

  y = drawSummary(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 10 })
  y = drawStages(getLastPage(), newPage, travel.stages, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })
  y = drawExpenses(getLastPage(), newPage, travel.expenses, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })
  y = drawDays(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 9 })

  await attachReceipts(pdfDoc, receiptMap, { font: font, edge: edge / 2, fontSize: 16 })

  return await pdfDoc.save()
}

function drawGeneralTravelInformation(page, travel, options = { font }) {
  if (!travel || !options.font) {
    return
  }
  const edge = options.edge ? options.edge : 36
  const opts = {
    fontSize: 11,
    xStart: edge,
    yStart: page.getSize().height - edge,
    textColor: pdf_lib.rgb(0, 0, 0)
  }
  Object.assign(opts, options)

  // Title
  var y = opts.yStart - (opts.fontSize * 1.5)
  page.drawText(travel.name, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize * 1.5,
    font: opts.font,
    color: opts.textColor
  })

  // Traveler
  var y = y - (opts.fontSize * 1.5 * 1.5)
  page.drawText(i18n.t('labels.traveler') + ': ' + travel.traveler.name + (travel.claimSpouseRefund ? ' & ' + travel.fellowTravelersNames : ''), {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  // Reason + Place
  var y = y - (opts.fontSize * 1.5)
  drawPlace(page, travel.destinationPlace, Object.assign(opts, { x: opts.xStart, y: y, prefix: i18n.t('labels.reason') + ': ' + travel.reason + '    ' + i18n.t('labels.destinationPlace') + ': ' }))

  // Dates + professionalShare
  var text = i18n.t('labels.from') + ': ' + new Date(travel.startDate).toLocaleDateString(i18n.language) + '    ' + i18n.t('labels.to') + ': ' + new Date(travel.endDate).toLocaleDateString(i18n.language)
  if (travel.professionalShare !== 1) {
    text = text + '    ' + i18n.t('labels.professionalShare') + ': ' + Math.round(travel.professionalShare / 100) * 100 + '%'
  }
  var y = y - (opts.fontSize * 1.5)
  page.drawText(text, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })
  return y
}

function getReceiptMap(travel) {
  const map = {}
  var number = 1
  for (const stage of travel.stages) {
    if (stage.cost && stage.cost.receipts) {
      for (const receipt of stage.cost.receipts) {
        map[receipt._id.toString()] = Object.assign({ number: number++, date: stage.cost.date }, receipt._doc)
      }
    }
  }

  for (const expense of travel.expenses) {
    if (expense.cost && expense.cost.receipts) {
      for (const receipt of expense.cost.receipts) {
        map[receipt._id.toString()] = Object.assign({ number: number++, date: expense.cost.date }, receipt._doc)
      }
    }
  }
  return map
}

function drawSummary(page, newPageFn, travel, options = { font }) {
  const columns = []
  columns.push({ key: 'reference', width: 100, alignment: pdf_lib.TextAlignment.Left })
  columns.push({ key: 'sum', width: 65, alignment: pdf_lib.TextAlignment.Right, fn: (m) => scripts.getDetailedMoneyString(m, i18n.language, true) })

  const summary = []
  summary.push({ reference: i18n.t('labels.lumpSums'), sum: scripts.getLumpSumsSum(travel) })
  summary.push({ reference: i18n.t('labels.expenses'), sum: scripts.getExpensesSum(travel) })
  if (travel.advance.amount > 0) {
    travel.advance.amount = -1 * travel.advance.amount
    summary.push({ reference: i18n.t('labels.advance'), sum: travel.advance })
    travel.advance.amount = -1 * travel.advance.amount
  }
  summary.push({ reference: i18n.t('labels.total'), sum: scripts.getTravelTotal(travel) })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.summary'), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  options.yStart -= fontSize * 1.25
  options.firstRow = false

  return drawTable(page, newPageFn, summary, columns, options)
}

function drawStages(page, newPageFn, stages, receiptMap, options = { font }) {
  const columns = []
  columns.push({ key: 'departure', width: 65, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.departure'), fn: (d) => scripts.dateTimeToString(d) })
  columns.push({ key: 'arrival', width: 65, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.arrival'), fn: (d) => scripts.dateTimeToString(d) })
  columns.push({ key: 'startLocation', width: 150, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.startLocation'), fn: (p) => p.place + ', ' + p.country.name[i18n.language], pseudoSuffix: 'mim', cb: drawFlag, cbValue: (p) => p.country._id })
  columns.push({ key: 'endLocation', width: 150, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.endLocation'), fn: (p) => p.place + ', ' + p.country.name[i18n.language], pseudoSuffix: 'mim', cb: drawFlag, cbValue: (p) => p.country._id })
  columns.push({ key: 'transport', width: 90, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.transport'), fn: (t) => i18n.t('labels.' + t) })
  columns.push({ key: 'distance', width: 65, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.distance') })
  columns.push({ key: 'purpose', width: 50, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.purpose'), fn: (p) => i18n.t('labels.' + p) })
  columns.push({ key: 'cost', width: 80, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.cost'), fn: (m) => scripts.getDetailedMoneyString(m, i18n.language) })
  columns.push({ key: 'cost', width: 35, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.receiptNumber'), fn: (m) => m.receipts.map((r) => receiptMap[r._id].number) })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.stages'), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  options.yStart -= fontSize * 1.25

  return drawTable(page, newPageFn, stages, columns, options)
}

function drawExpenses(page, newPageFn, expenses, receiptMap, options = { font }) {
  if (expenses.length == 0) {
    return options.yStart
  }
  const columns = []
  columns.push({ key: 'description', width: 270, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.description') })
  columns.push({ key: 'purpose', width: 50, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.purpose'), fn: (p) => i18n.t('labels.' + p) })
  columns.push({ key: 'cost', width: 90, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.cost'), fn: (m) => scripts.getDetailedMoneyString(m, i18n.language) })
  columns.push({ key: 'cost', width: 90, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.invoiceDate'), fn: (c) => scripts.datetoDateStringWithYear(c.date) })
  columns.push({ key: 'cost', width: 35, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.receiptNumber'), fn: (m) => m.receipts.map((r) => receiptMap[r._id].number) })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.expenses'), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  options.yStart -= fontSize * 1.25

  return drawTable(page, newPageFn, expenses, columns, options)
}

function drawDays(page, newPageFn, travel, options = { font }) {
  const columns = []
  columns.push({ key: 'date', width: 70, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.date'), fn: (d) => scripts.datetoDateString(d) })
  columns.push({ key: 'country', width: 120, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.country'), fn: (c) => c.name[i18n.language], pseudoSuffix: 'mim', cb: drawFlag, cbValue: (c) => c._id })
  columns.push({ key: 'purpose', width: 50, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.purpose'), fn: (p) => i18n.t('labels.' + p) })
  columns.push({ key: 'cateringNoRefund', width: 80, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.cateringNoRefund'), fn: (c) => Object.keys(c).map((k) => c[k] ? i18n.t('labels.' + k) : '').join(' ') })
  columns.push({ key: 'refunds', width: 80, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('lumpSums.catering24\n'), fn: (r) => r.filter((r) => r.type.indexOf('catering') === 0).length > 0 ? scripts.getDetailedMoneyString(r.filter((r) => r.type.indexOf('catering') === 0)[0].refund, i18n.language) : '' })
  columns.push({ key: 'refunds', width: 80, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('lumpSums.overnight\n'), fn: (r) => r.filter((r) => r.type == 'overnight').length > 0 ? scripts.getDetailedMoneyString(r.filter((r) => r.type == 'overnight')[0].refund, i18n.language) : '' })

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

async function attachReceipts(pdfDoc, receiptMap, options = { font }) {
  if (!options.font) {
    return
  }
  const opts = {
    fontSize: 16,
    textColor: pdf_lib.rgb(0, 0, 0),
    edge: 36
  }
  Object.assign(opts, options)

  function drawNumber(page, receipt) {
    const text = '#' + receipt.number + ' - ' + scripts.datetoDateStringWithYear(receipt.date)
    const width = opts.font.widthOfTextAtSize(text, opts.fontSize)
    page.drawRectangle({
      x: 2,
      y: page.getSize().height - (opts.fontSize + 2),
      width: width,
      height: opts.fontSize + 2,
      color: pdf_lib.rgb(1, 1, 1),
      opacity: 0.5,
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
    const data = (await DocumentFile.findOne({ _id: receipt._id })).data
    if (receipt.type == 'application/pdf') {
      const insertPDF = await pdf_lib.PDFDocument.load(data)
      const pages = await pdfDoc.copyPages(insertPDF, insertPDF.getPageIndices())
      for (const p of pages) {
        const page = pdfDoc.addPage(p)
        drawNumber(page, receipt)
      }
    } else {
      var image = {}
      if (receipt.type === 'image/jpeg') {
        image = await pdfDoc.embedJpg(data)
      } else if (receipt.type === 'image/png') {
        image = await pdfDoc.embedPng(data)
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


async function drawPlace(page, place, options = { font, x, y }) {
  if (!place || !options.font) {
    return
  }
  const opts = {
    fontSize: 11,
    x: 10,
    y: 10,
    textColor: pdf_lib.rgb(0, 0, 0),
    prefix: ''
  }
  Object.assign(opts, options)

  const text = opts.prefix + place.place + ', ' + place.country.name[i18n.language]
  const flagX = opts.x + opts.font.widthOfTextAtSize(text, opts.fontSize) + (opts.fontSize / 4)

  page.drawText(text, {
    x: opts.x,
    y: opts.y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  opts.x = flagX
  drawFlag(page, place.country._id, opts)
}

async function drawFlag(page, countryCode, options = { x, y, fontSize }) {
  if (!countryCode) {
    return
  }
  const opts = {
    fontSize: 11,
    x: 10,
    y: 10
  }
  Object.assign(opts, options)

  var filename = countryCode
  if (opts.fontSize > 42 * 0.75) { // 0.75 px <=> 1 pt
    filename = filename + '@3x'
  } else if (opts.fontSize > 21 * 0.75) { // 0.75 px <=> 1 pt
    filename = filename + '@2x'
  }
  const flagBytes = fs.readFileSync('./pdf/flags/' + filename + '.png')
  const flag = await page.doc.embedPng(flagBytes)

  page.drawImage(flag, {
    x: opts.x,
    y: opts.y - (opts.fontSize / 9),
    height: opts.fontSize,
    width: opts.fontSize * (3 / 2)
  })

}

async function drawLogo(page, options = { font, x, y }) {
  if (!options.font) {
    return
  }
  const opts = {
    fontSize: 11,
    x: 10,
    y: 10,
    textColor: pdf_lib.rgb(0, 0, 0),
    prefix: ''
  }
  Object.assign(opts, options)

  const text = i18n.t('headlines.title')
  const flagX = opts.x + opts.font.widthOfTextAtSize(text, opts.fontSize) + (opts.fontSize / 4)

  page.drawText(text, {
    x: opts.x,
    y: opts.y,
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
    y: opts.y - (opts.fontSize / 9),
    height: opts.fontSize,
    width: opts.fontSize
  })
}

function drawTable(page, newPageFn, data, columns, options = { font }) {
  if (!data || data.length < 0 || !options.font) {
    return
  }
  const edge = options.edge ? options.edge : 36
  const fontSize = options.fontSize ? options.fontSize : 11
  const cellHeight = options.cellHeight ? options.cellHeight : fontSize * 1.5
  const opts = {
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
  }
  Object.assign(opts, options)

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
    const columnBorders = []
    const cellTexts = []
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
        lineHeight: fontSize,
        bounds: {
          width: column.width - (opts.textPadding.x * 3),
          height: fontSize,
          x: x,
          y: y,
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
          },
        })
      }
      if (multiText.lines.length > 0 && !opts.firstRow) {
        if (column.pseudoSuffix) {
          cellTexts[cellTexts.length - 1].text = cellTexts[cellTexts.length - 1].text.slice(0, cellTexts[cellTexts.length - 1].text.length - column.pseudoSuffix.length)
          cellTexts[cellTexts.length - 1].pseudoSuffixWidth = opts.font.widthOfTextAtSize(column.pseudoSuffix, opts.fontSize) - opts.font.widthOfTextAtSize(' ', opts.fontSize)
        }
        cellTexts[cellTexts.length - 1].cb = column.cb
        if (column.cbValue) {
          cellTexts[cellTexts.length - 1].cbValue = column.cbValue(datum)
        }


      }

      columnBorders.push({ // vertical border ╫
        start: { x: x - opts.borderThickness, y: y + opts.cellHeight - opts.borderThickness },
        end: { x: x - opts.borderThickness },
        thickness: opts.borderThickness,
        color: opts.borderColor,
      })
      yMin = multiText.bounds.y < yMin ? multiText.bounds.y : yMin
      x = x + column.width
    }
    if (yMin < opts.minimumY) {
      page.drawLine({ // top border ╤
        start: { x: opts.xStart - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
        end: { x: x - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
        thickness: opts.borderThickness,
        color: opts.borderColor,
      })
      page.drawLine({ // right border ╢
        start: { x: x - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
        end: { x: x - opts.borderThickness, y: y + opts.cellHeight - opts.borderThickness },
        thickness: opts.borderThickness,
        color: opts.borderColor,
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
        text.cb(page, text.cbValue, { y: text.options.y, x: text.options.x + text.options.width - text.pseudoSuffixWidth, fontSize: opts.fontSize })
      }
    }
    for (const border of columnBorders) {
      border.end.y = yMin - opts.borderThickness
      page.drawLine(border)
    }
    y = yMin
    page.drawLine({ // horizontal border ╪
      start: { x: opts.xStart - opts.borderThickness, y: y - opts.borderThickness },
      end: { x: x - opts.borderThickness, y: y - opts.borderThickness },
      thickness: opts.borderThickness,
      color: opts.borderColor,
    })
    y = y - opts.cellHeight
  }
  page.drawLine({ // top border ╤
    start: { x: opts.xStart - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
    end: { x: x - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
    thickness: opts.borderThickness,
    color: opts.borderColor,
  })
  page.drawLine({ // right border ╢
    start: { x: x - opts.borderThickness, y: opts.yStart + opts.cellHeight - opts.borderThickness },
    end: { x: x - opts.borderThickness, y: y + opts.cellHeight - opts.borderThickness },
    thickness: opts.borderThickness,
    color: opts.borderColor,
  })
  return y
}


module.exports = {
  generateReport,
  test,
  generateAndWriteToDisk
}