import fs from 'fs/promises'
import { Types, mongo } from 'mongoose'
import pdf_lib, { PDFName, PDFString } from 'pdf-lib'
import Formatter from '../../common/formatter.js'
import { addUp } from '../../common/scripts.js'
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
  let path = '/reports/'
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
  const formatter = new Formatter(i18n.language as Locale)
  const totalSum = formatter.money(addUp(report).total)
  const org = await Organisation.findOne({ _id: report.project.organisation._id })
  const subfolder = org ? org.subfolderPath : ''
  path += subfolder + report.owner.name.familyName + ' ' + report.owner.name.givenName[0] + ' - ' + report.name + ' ' + totalSum + '.pdf'
  return path
}

export interface Options {
  font: pdf_lib.PDFFont
  fontSize: number
  xStart: number
  yStart: number
  textColor?: pdf_lib.Color
  edge?: number
  language: Locale
  formatter: Formatter
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
    const text = '#' + receipt.number + ' - ' + opts.formatter.date(receipt.date)
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
      let image: pdf_lib.PDFImage
      if (receipt.type === 'image/jpeg') {
        const zeroOffsetData = new Uint8Array(data, 0)
        image = await pdfDoc.embedJpg(zeroOffsetData)
      } else {
        // receipt.type === 'image/png'
        image = await pdfDoc.embedPng(data)
      }
      let page = null
      if (image.width > image.height) {
        page = pdfDoc.addPage([pdf_lib.PageSizes.A4[1], pdf_lib.PageSizes.A4[0]]) // landscape page
      } else {
        page = pdfDoc.addPage(pdf_lib.PageSizes.A4)
      }
      let size = image.scaleToFit(page.getSize().width - opts.edge * 2, page.getSize().height - opts.edge * 2)
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

  let text = opts.prefix
  if (place.place) {
    text += place.place + ', '
  }
  text += place.country.name[opts.language]
  const flagX = opts.xStart + opts.font.widthOfTextAtSize(text, opts.fontSize) + opts.fontSize / 4

  page.drawText(text, {
    x: opts.xStart,
    y: opts.yStart,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  opts.xStart = flagX
  await drawFlag(page, place.country._id, opts)
}

export async function drawFlag(page: pdf_lib.PDFPage, countryCode: string, options: Options) {
  const opts = options

  let filename = countryCode
  if (opts.fontSize > 42 * 0.75) {
    // 0.75 px <=> 1 pt
    filename = filename + '@3x'
  } else if (opts.fontSize > 21 * 0.75) {
    // 0.75 px <=> 1 pt
    filename = filename + '@2x'
  }
  const flagBytes = await fs.readFile('./pdf/flags/' + filename + '.png')
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

  const text = i18n.t('headlines.title', { lng: opts.language })
  const flagX = opts.xStart + opts.font.widthOfTextAtSize(text, opts.fontSize) + opts.fontSize / 4

  page.drawText(text, {
    x: opts.xStart,
    y: opts.yStart,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  let filename = 'receipt'
  if (opts.fontSize > 24) {
    filename = filename + '36'
  } else if (opts.fontSize > 12) {
    filename = filename + '24'
  } else {
    filename = filename + '12'
  }
  const logoBytes = await fs.readFile('./pdf/receipt/' + filename + '.png')
  const logo = await page.doc.embedPng(logoBytes)

  page.drawImage(logo, {
    x: flagX,
    y: opts.yStart - opts.fontSize / 9,
    height: opts.fontSize,
    width: opts.fontSize
  })
}

export async function drawOrganisationLogo(
  page: pdf_lib.PDFPage,
  organisationId: Types.ObjectId | string,
  options: { xStart: number; yStart: number; maxWidth: number; maxHeight: number }
) {
  const orga = await Organisation.findOne({ _id: organisationId }).lean()
  if (!orga || !orga.logo) {
    return
  }
  const doc = await DocumentFile.findOne({ _id: orga.logo }).lean()
  if (!doc) {
    console.error('No DocumentFile found for id: ' + orga.logo)
    return
  }
  const data = (doc.data as any as mongo.Binary).buffer
  let image: pdf_lib.PDFImage
  if (doc.type === 'image/jpeg') {
    const zeroOffsetData = new Uint8Array(data, 0)
    image = await page.doc.embedJpg(zeroOffsetData)
  } else {
    // receipt.type === 'image/png'
    image = await page.doc.embedPng(data)
  }

  let size = image.scaleToFit(options.maxWidth, options.maxHeight)
  if (size.width > image.width) {
    size = image.size()
  }
  // align on right side
  const x = options.xStart + (options.maxWidth - size.width)
  const y = options.yStart + (options.maxHeight - size.height)

  if (orga.website) {
    drawLink(page, orga.website, { xStart: x, yStart: y, width: size.width, height: size.height })
  }
  page.drawImage(image, {
    x: x,
    y: y,
    width: size.width,
    height: size.height
  })
}

export function drawLink(page: pdf_lib.PDFPage, url: string, options: { xStart: number; yStart: number; width: number; height: number }) {
  const linkAnnotation = page.doc.context.obj({
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
  const linkAnnotationRef = page.doc.context.register(linkAnnotation)
  page.node.set(PDFName.of('Annots'), page.doc.context.obj([linkAnnotationRef]))
}

export async function drawTable(
  page: pdf_lib.PDFPage,
  newPageFn: () => pdf_lib.PDFPage,
  data: any[],
  columns: Column[],
  options: TabelOptions
) {
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

  let x = opts.xStart
  let y = opts.yStart
  for (let i = 0; i < data.length; i++) {
    x = opts.xStart
    let yMin = y
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
      let cell = datum
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
      page = newPageFn()
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
        await text.cb(page, text.cbValue, {
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
