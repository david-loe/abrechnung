import fs from 'fs'
import { mongo } from 'mongoose'
import pdf_lib from 'pdf-lib'
import { datetoDateStringWithYear, getMoneyString, getTotal } from '../../common/scripts.js'
import {
  Cost,
  CountrySimple,
  ExpenseReport,
  HealthCareCost,
  DocumentFile as IDocumentFile,
  Locale,
  Travel,
  reportIsHealthCareCost,
  reportIsTravel
} from '../../common/types.js'
import i18n from '../i18n.js'
import DocumentFile from '../models/documentFile.js'
import Organisation from '../models/organisation.js'

export async function writeToDiskFilePath(report: Travel | ExpenseReport | HealthCareCost): Promise<string> {
  var path = '/reports/'
  if (reportIsTravel(report)) {
    if (report.state === 'approved') {
      path += 'advance/'
    } else {
      path += 'travel/'
    }
  } else if (reportIsHealthCareCost(report)) {
    if (report.state === 'refunded') {
      path += 'healthCareCost/confirmed/'
    } else {
      path += 'healthCareCost/'
    }
  } else {
    path += 'expenseReport/'
  }
  const totalSum = getMoneyString(getTotal(report), false)
  const org = await Organisation.findOne({ _id: report.organisation._id })
  const subfolder = org ? org.subfolderPath : ''
  path += subfolder + report.owner.name.familyName + ' ' + report.owner.name.givenName[0] + ' - ' + report.name + ' ' + totalSum + '.pdf'
  return path
}

export function writeToDisk(filePath: string, pdfBytes: Uint8Array) {
  // create folders
  var root = ''
  var folderPath = filePath
  if (folderPath[0] === '/') {
    root = '/'
    folderPath = folderPath.slice(1)
  }
  const folders = folderPath.split('/').slice(0, -1) // remove last item (file)
  folders.reduce(
    (acc, folder) => {
      const cfolderPath = acc + folder + '/'
      if (!fs.existsSync(cfolderPath)) {
        fs.mkdirSync(cfolderPath)
      }
      return cfolderPath
    },
    root // first 'acc', important
  )

  fs.writeFile(filePath, pdfBytes, (err) => {
    if (err) {
      // Second try after 10 seconds
      setTimeout(function () {
        fs.writeFile(filePath, pdfBytes, (err) => {
          if (err) {
            // Third try after another 10 seconds
            setTimeout(function () {
              fs.writeFile(filePath, pdfBytes, (err) => {
                if (err) {
                  console.error(err)
                }
              })
            }, 10000)
          }
        })
      }, 10000)
    }
  })
}

export interface Options {
  font: pdf_lib.PDFFont
  fontSize: number
  xStart: number
  yStart: number
  textColor?: pdf_lib.Color
  edge?: number
}

export interface TabelOptions extends Options {
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

export interface Column {
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
  noNumberPrint?: boolean
}
export interface ReceiptMap {
  [key: string]: ReceiptMapEntry
}

export function getReceiptMap(costList: { cost: Cost }[], number: number = 1) {
  const map: ReceiptMap = {}
  for (const cost of costList) {
    if (cost.cost && cost.cost.receipts) {
      for (const receipt of cost.cost.receipts) {
        map[receipt._id!.toString()] = Object.assign({ number: number++, date: cost.cost.date as Date }, receipt)
      }
    }
  }
  return { map, number }
}

export async function attachReceipts(pdfDoc: pdf_lib.PDFDocument, receiptMap: ReceiptMap, options: Omit<Options, 'xStart' | 'yStart'>) {
  const opts = Object.assign(
    {
      fontSize: 16,
      textColor: pdf_lib.rgb(0, 0, 0),
      edge: 36
    },
    options
  )

  function drawNumber(page: pdf_lib.PDFPage, receipt: ReceiptMapEntry) {
    if (receipt.noNumberPrint) {
      return
    }
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
    const doc = await DocumentFile.findOne({ _id: receipt._id }).lean()
    if (!doc) {
      console.error('No DocumentFile found for id: ' + receipt._id)
      continue
    }
    const data = (doc.data as any as mongo.Binary).buffer
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

export async function drawPlace(page: pdf_lib.PDFPage, place: { country: CountrySimple; place?: string }, options: Options) {
  const opts = Object.assign(
    {
      textColor: pdf_lib.rgb(0, 0, 0),
      prefix: ''
    },
    options
  )

  var text = opts.prefix
  if (place.place) {
    text += place.place + ', '
  }
  text += place.country.name[i18n.language as Locale]
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

export async function drawFlag(page: pdf_lib.PDFPage, countryCode: string, options: Options) {
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

export async function drawLogo(page: pdf_lib.PDFPage, options: Options) {
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

  var filename = 'receipt'
  if (opts.fontSize > 24) {
    filename = filename + '36'
  } else if (opts.fontSize > 12) {
    filename = filename + '24'
  } else {
    filename = filename + '12'
  }
  const logoBytes = fs.readFileSync('./pdf/receipt/' + filename + '.png')
  const logo = await page.doc.embedPng(logoBytes)

  page.drawImage(logo, {
    x: flagX,
    y: opts.yStart - opts.fontSize / 9,
    height: opts.fontSize,
    width: opts.fontSize
  })
}

export function drawTable(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, data: any[], columns: Column[], options: TabelOptions) {
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
