import fs from 'node:fs/promises'
import pdf_fontkit from 'pdf-fontkit'
import pdf_lib, { PDFName, PDFString } from 'pdf-lib'
import Formatter from '../../common/formatter.js'
import { hexToRGB } from '../../common/scripts.js'
import {
  _id,
  CountryCode,
  CountrySimple,
  DocumentFile,
  DocumentFileType,
  Locale,
  PageOrientation,
  PrinterSettings,
  PrintSettingsBase
} from '../../common/types.js'

export interface PrintSettings extends PrintSettingsBase {
  language: Locale
  defaultPageOrientation: PageOrientation
}

interface PrintSettingsWithColorObjects extends Omit<PrintSettings, 'textColor' | 'borderColor'> {
  textColor: pdf_lib.Color
  borderColor: pdf_lib.Color
}

export interface Options {
  fontSize: number
  xStart: number
  yStart: number
}

export interface TableOptions extends Options {
  cellHeight?: number
  defaultCellWidth?: number
  firstRow?: boolean
}

// biome-ignore lint/suspicious/noExplicitAny: typing to complex
export interface Column<Type extends {} = any> {
  key: keyof Type
  width: number
  alignment: pdf_lib.TextAlignment
  title: string
  // biome-ignore lint/suspicious/noExplicitAny: typing to complex
  fn?: (p: any) => string
  // biome-ignore lint/suspicious/noExplicitAny: typing to complex
  countryCodeForFlag?: (p: any) => CountryCode
}

interface ReceiptMapEntry extends DocumentFile {
  number: number
  date: Date
  noNumberPrint?: boolean
}
export interface ReceiptMap {
  [key: string]: ReceiptMapEntry
}

export class Printer {
  formatter: Formatter
  settings: PrinterSettings
  getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById']
  getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById']
  translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string

  constructor(
    settings: PrinterSettings,
    formatter: Formatter,
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string,
    getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById']
  ) {
    this.settings = settings
    this.formatter = formatter
    this.getDocumentFileBufferById = getDocumentFileBufferById
    this.getOrganisationLogoIdById = getOrganisationLogoIdById
    this.translateFunc = translateFunc
  }

  setSettings(settings: PrinterSettings) {
    this.settings = settings
  }
}

// From https://github.com/Hopding/pdf-lib
// biome-ignore lint/suspicious/noControlCharactersInRegex: Vertical Tab (VT)
const lineSplit = (text: string) => text.split(/[\n\f\r\u000B]/)
const cleanText = (text: string) => text.replace(/\t|\u0085|\u2028|\u2029/g, '    ').replace(/[\b\v]/g, '')
const lastIndexOfWhitespace = (line: string) => {
  for (let idx = line.length; idx > 0; idx--) {
    if (/\s/.test(line[idx])) return idx
  }
  return undefined
}
const splitOutLines = (input: string, maxWidth: number, font: pdf_lib.PDFFont, fontSize: number) => {
  let lastWhitespaceIdx = input.length
  while (lastWhitespaceIdx > 0) {
    const line = input.substring(0, lastWhitespaceIdx)
    const encoded = font.encodeText(line)
    const width = font.widthOfTextAtSize(line, fontSize)
    if (width < maxWidth) {
      const remainder = input.substring(lastWhitespaceIdx) || undefined
      return { line, encoded, width, remainder }
    }
    lastWhitespaceIdx = lastIndexOfWhitespace(line) ?? 0
  }

  // We were unable to split the input enough to get a chunk that would fit
  // within the specified `maxWidth` so we'll just return everything
  return { line: input, encoded: font.encodeText(input), width: font.widthOfTextAtSize(input, fontSize), remainder: undefined }
}

const layoutMultilineText = (
  text: string,
  { alignment, fontSize, font, bounds, lineHeightFactor }: pdf_lib.LayoutTextOptions & { lineHeightFactor?: number }
): pdf_lib.MultilineTextLayout => {
  const lines = lineSplit(cleanText(text))

  if (fontSize === undefined || fontSize === 0) {
    fontSize = 12
  }
  if (lineHeightFactor === undefined) {
    lineHeightFactor = 0.2
  }
  const height = font.heightAtSize(fontSize)
  const lineHeight = height + height * lineHeightFactor

  const textLines: pdf_lib.TextPosition[] = []

  let minX = bounds.x
  let minY = bounds.y
  let maxX = bounds.x + bounds.width
  let maxY = bounds.y + bounds.height

  let y = bounds.y + bounds.height
  for (let idx = 0, len = lines.length; idx < len; idx++) {
    let prevRemainder: string | undefined = lines[idx]
    while (prevRemainder !== undefined) {
      const { line, encoded, width, remainder } = splitOutLines(prevRemainder, bounds.width, font, fontSize)

      // prettier-ignore
      const x =
        alignment === pdf_lib.TextAlignment.Left
          ? bounds.x
          : alignment === pdf_lib.TextAlignment.Center
            ? bounds.x + bounds.width / 2 - width / 2
            : alignment === pdf_lib.TextAlignment.Right
              ? bounds.x + bounds.width - width
              : bounds.x

      y -= lineHeight

      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x + width > maxX) maxX = x + width
      if (y + height > maxY) maxY = y + height

      textLines.push({ text: line, encoded, width, height, x, y })

      // Only trim lines that we had to split ourselves. So we won't trim lines
      // that the user provided themselves with whitespace.
      prevRemainder = remainder?.trim()
    }
  }

  return { fontSize, lineHeight, lines: textLines, bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } }
}

const FLAG_PSEUDO_SUFFIX = 'mim'
export const EMPTY_CELL = '---'

export class PDFDrawer {
  font: pdf_lib.PDFFont
  doc: pdf_lib.PDFDocument
  formatter: Formatter
  settings: PrintSettingsWithColorObjects
  currentPage!: pdf_lib.PDFPage
  getDocumentFileBufferById: (id: _id) => Promise<{ buffer: Uint8Array<ArrayBufferLike>; type: DocumentFileType } | null>
  getOrganisationLogoIdById: (id: _id) => Promise<{ logoId: _id; website?: string | null } | null>

  constructor(
    settings: PrintSettings,
    doc: pdf_lib.PDFDocument,
    getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById'],
    font: pdf_lib.PDFFont,
    formatter: Formatter
  ) {
    this.doc = doc
    this.font = font
    this.formatter = formatter
    this.settings = Object.assign({}, settings, {
      textColor: pdf_lib.componentsToColor(hexToRGB(settings.textColor)),
      borderColor: pdf_lib.componentsToColor(hexToRGB(settings.borderColor))
    })
    this.getDocumentFileBufferById = getDocumentFileBufferById
    this.getOrganisationLogoIdById = getOrganisationLogoIdById
    this.formatter.setLocale(this.settings.language)
    this.newPage()
  }

  static async create(
    settings: PrinterSettings,
    getDocumentFileBufferById: PDFDrawer['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer['getOrganisationLogoIdById'],
    formatter: Formatter,
    language: Locale,
    defaultPageOrientation: PageOrientation
  ) {
    const doc = await pdf_lib.PDFDocument.create()
    doc.registerFontkit(pdf_fontkit)
    const fontBytes = await fs.readFile(`../common/fonts/${settings.fontName}.ttf`)
    const font = await doc.embedFont(fontBytes, { subset: true })
    const printSettings = { ...settings, language, defaultPageOrientation }
    return new PDFDrawer(printSettings, doc, getDocumentFileBufferById, getOrganisationLogoIdById, font, formatter)
  }

  async finish() {
    return await this.doc.save()
  }

  newPage(orientation: PageOrientation = this.settings.defaultPageOrientation) {
    let size: [number, number]
    if (orientation === 'portrait') {
      size = [this.settings.pageSize.width, this.settings.pageSize.height]
    } else {
      size = [this.settings.pageSize.height, this.settings.pageSize.width]
    }
    this.currentPage = this.doc.addPage(size)
  }

  /**
   * returns bottom y end
   */
  drawMultilineText(text: string, options: Options & { alignment?: pdf_lib.TextAlignment; width?: number }) {
    const opts = Object.assign(options, {
      alignment: pdf_lib.TextAlignment.Left,
      width: this.currentPage.getSize().width - this.settings.pagePadding - options.xStart
    })
    const multiLineText = layoutMultilineText(text, {
      alignment: opts.alignment,
      font: this.font,
      fontSize: opts.fontSize,
      bounds: { width: opts.width, height: opts.fontSize, x: opts.xStart, y: opts.yStart },
      lineHeightFactor: 0
    })
    for (const line of multiLineText.lines) {
      this.drawText(line.text, { xStart: line.x, yStart: line.y, fontSize: opts.fontSize })
    }
    return opts.yStart - multiLineText.bounds.height
  }

  async drawMultilineTextWithPlace(
    text: string,
    place: { country: CountrySimple; place?: string },
    options: Options & { alignment?: pdf_lib.TextAlignment; width?: number }
  ) {
    let textWithPlace = text
    const opts = Object.assign(options, {
      alignment: pdf_lib.TextAlignment.Left,
      width: this.currentPage.getSize().width - this.settings.pagePadding - options.xStart
    })
    const flagPseudoSuffixWidth =
      this.font.widthOfTextAtSize(FLAG_PSEUDO_SUFFIX, options.fontSize) - this.font.widthOfTextAtSize(' ', options.fontSize)
    if (place.place) {
      textWithPlace += `${place.place}, `
    }
    textWithPlace += place.country.name[this.settings.language]
    textWithPlace += FLAG_PSEUDO_SUFFIX

    const multiLineText = layoutMultilineText(textWithPlace, {
      alignment: opts.alignment,
      font: this.font,
      fontSize: opts.fontSize,
      bounds: { width: opts.width, height: opts.fontSize, x: opts.xStart, y: opts.yStart },
      lineHeightFactor: 0
    })
    const len = multiLineText.lines.length
    if (len > 0) {
      const lastLine = multiLineText.lines[len - 1]
      lastLine.text = lastLine.text.slice(0, lastLine.text.length - FLAG_PSEUDO_SUFFIX.length)

      for (const line of multiLineText.lines) {
        this.drawText(line.text, { xStart: line.x, yStart: line.y, fontSize: opts.fontSize })
      }
      await this.drawFlag(place.country._id, {
        xStart: lastLine.x + lastLine.width - flagPseudoSuffixWidth,
        yStart: lastLine.y,
        fontSize: opts.fontSize
      })
    }
    return opts.yStart - multiLineText.bounds.height
  }

  drawText(text: string, options: Options) {
    this.currentPage.drawText(text, {
      x: options.xStart,
      y: options.yStart,
      size: options.fontSize,
      font: this.font,
      color: this.settings.textColor
    })
  }

  drawReceiptNumber(receipt: ReceiptMapEntry) {
    if (receipt.noNumberPrint) {
      return
    }
    const text = `#${receipt.number}${receipt.date ? ` - ${this.formatter.date(receipt.date)}` : ''}`
    const width = this.font.widthOfTextAtSize(text, this.settings.fontSizes.L)
    this.currentPage.drawRectangle({
      x: 2,
      y: this.currentPage.getSize().height - (this.settings.fontSizes.L + 2),
      width: width,
      height: this.settings.fontSizes.L + 4,
      color: pdf_lib.rgb(1, 1, 1), //white
      opacity: 0.5
    })
    this.drawText(text, {
      xStart: 2,
      yStart: this.currentPage.getSize().height - (this.settings.fontSizes.L + 2),
      fontSize: this.settings.fontSizes.L
    })
  }

  async attachReceipts(receiptMap: ReceiptMap) {
    for (const receiptId in receiptMap) {
      const receipt = receiptMap[receiptId]
      const doc = await this.getDocumentFileBufferById(receipt._id)
      if (!doc) {
        console.error(`No DocumentFile found for id: ${receipt._id}`)
        continue
      }
      try {
        if (receipt.type === 'application/pdf') {
          const insertPDF = await pdf_lib.PDFDocument.load(doc.buffer)
          const pages = await this.doc.copyPages(insertPDF, insertPDF.getPageIndices())
          for (const p of pages) {
            this.currentPage = this.doc.addPage(p)
            this.drawReceiptNumber(receipt)
          }
        } else {
          let image: pdf_lib.PDFImage
          if (receipt.type === 'image/jpeg') {
            const zeroOffsetData = new Uint8Array(doc.buffer, 0)
            image = await this.doc.embedJpg(zeroOffsetData)
          } else {
            // receipt.type === 'image/png'
            image = await this.doc.embedPng(doc.buffer)
          }
          if (image.width > image.height) {
            this.newPage('landscape')
          } else {
            this.newPage('portrait')
          }
          let size = image.scaleToFit(
            this.currentPage.getSize().width - this.settings.pagePadding, // only half padding
            this.currentPage.getSize().height - this.settings.pagePadding
          )
          if (size.width > image.width) {
            size = image.size()
          }
          this.currentPage.drawImage(image, {
            x: (this.currentPage.getSize().width - size.width) / 2,
            y: (this.currentPage.getSize().height - size.height) / 2,
            width: size.width,
            height: size.height
          })
          this.drawReceiptNumber(receipt)
        }
      } catch (error) {
        console.error(`Error while trying to add Document (${receipt._id})[${doc.type}] to PDF: ${error}`)
      }
    }
  }

  async drawFlag(countryCode: CountryCode, options: Options) {
    const opts = options

    let filename = countryCode
    if (opts.fontSize > 42 * 0.75) {
      // 0.75 px <=> 1 pt
      filename = `${filename}@3x`
    } else if (opts.fontSize > 21 * 0.75) {
      // 0.75 px <=> 1 pt
      filename = `${filename}@2x`
    }
    const flagBytes = await fs.readFile(`./pdf/flags/${filename}.png`)
    const flag = await this.doc.embedPng(flagBytes)

    this.currentPage.drawImage(flag, {
      x: opts.xStart,
      y: opts.yStart - opts.fontSize / 9,
      height: opts.fontSize,
      width: opts.fontSize * (3 / 2)
    })
  }

  /**
   * Oben links (xStart, yStart)
   */
  async drawLogo(title: string, options: Options) {
    let filename = 'receipt'
    if (options.fontSize > 24) {
      filename = `${filename}36`
    } else if (options.fontSize > 12) {
      filename = `${filename}24`
    } else {
      filename = `${filename}12`
    }
    const logoBytes = await fs.readFile(`./pdf/receipt/${filename}.png`)
    const logo = await this.doc.embedPng(logoBytes)
    const logoSize = this.font.heightAtSize(options.fontSize)
    const y = options.yStart - logoSize * 0.8

    this.currentPage.drawImage(logo, { x: options.xStart, y: y - logoSize / 5, height: logoSize, width: logoSize })

    this.drawText(title, { xStart: options.xStart + logoSize + options.fontSize / 4, yStart: y, fontSize: options.fontSize })
  }

  async drawOrganisationLogo(organisationId: _id, options: { xStart: number; yStart: number; maxWidth: number; maxHeight: number }) {
    const orga = await this.getOrganisationLogoIdById(organisationId)
    if (!orga) {
      return
    }
    const doc = await this.getDocumentFileBufferById(orga.logoId)
    if (!doc) {
      console.error(`No DocumentFile found for id: ${orga.logoId}`)
      return
    }

    let image: pdf_lib.PDFImage
    if (doc.type === 'image/jpeg') {
      const zeroOffsetData = new Uint8Array(doc.buffer, 0)
      image = await this.doc.embedJpg(zeroOffsetData)
    } else {
      // receipt.type === 'image/png'
      image = await this.doc.embedPng(doc.buffer)
    }

    let size = image.scaleToFit(options.maxWidth, options.maxHeight)
    if (size.width > image.width) {
      size = image.size()
    }
    // align on right side
    const x = options.xStart + (options.maxWidth - size.width)
    const y = options.yStart + (options.maxHeight - size.height)

    if (orga.website) {
      this.drawLink(orga.website, { xStart: x, yStart: y, width: size.width, height: size.height })
    }
    this.currentPage.drawImage(image, { x: x, y: y, width: size.width, height: size.height })
  }

  drawLink(url: string, options: { xStart: number; yStart: number; width: number; height: number }) {
    const linkAnnotation = this.doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [options.xStart, options.yStart, options.xStart + options.width, options.yStart + options.height],
      Border: [0, 0, 0],
      C: [0, 0, 1],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) }
    })
    const linkAnnotationRef = this.doc.context.register(linkAnnotation)
    this.currentPage.node.set(PDFName.of('Annots'), this.doc.context.obj([linkAnnotationRef]))
  }

  async drawTable<Type extends {}>(data: Type[], columns: Column<Type>[], options: TableOptions) {
    if (data.length === 0) {
      return options.yStart
    }
    const flagPseudoSuffixWidth =
      this.font.widthOfTextAtSize(FLAG_PSEUDO_SUFFIX, options.fontSize) - this.font.widthOfTextAtSize(' ', options.fontSize)
    const opts = Object.assign(
      {
        cellHeight: options.fontSize * 1.5,
        defaultCellWidth: 100,
        xStart: this.settings.pagePadding,
        yStart: this.currentPage.getSize().height - this.settings.pagePadding,
        newPageXStart: this.settings.pagePadding,
        newPageYStart: this.currentPage.getSize().height - this.settings.pagePadding,
        firstRow: true
      },
      options
    )

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
        options: { xStart: number; yStart: number; width: number; fontSize: number }
        countryCodeForFlag?: CountryCode
      }[] = []
      for (const column of columns) {
        const datum = data[i][column.key]
        let cell: string
        cell = String(datum)
        if (column.fn) {
          cell = column.fn(datum)
        }
        if (opts.firstRow) {
          cell = column.title
        }
        if (datum === undefined) {
          cell = EMPTY_CELL
        }
        const fontSize = opts.firstRow ? opts.fontSize + 1 : opts.fontSize
        const multiText = layoutMultilineText(cell + (column.countryCodeForFlag && !opts.firstRow ? FLAG_PSEUDO_SUFFIX : ''), {
          alignment: opts.firstRow ? pdf_lib.TextAlignment.Center : column.alignment,
          font: this.font,
          fontSize: fontSize,
          bounds: { width: column.width - this.settings.cellPadding.x * 3, height: fontSize, x: x, y: y },
          lineHeightFactor: 0
        })
        for (const line of multiText.lines) {
          cellTexts.push({
            text: line.text,
            options: {
              xStart: line.x + this.settings.cellPadding.x,
              yStart: line.y + this.settings.cellPadding.bottom,
              width: line.width,
              fontSize: fontSize
            }
          })
        }
        if (multiText.lines.length > 0 && !opts.firstRow) {
          if (column.countryCodeForFlag) {
            cellTexts[cellTexts.length - 1].text = cellTexts[cellTexts.length - 1].text.slice(
              0,
              cellTexts[cellTexts.length - 1].text.length - FLAG_PSEUDO_SUFFIX.length
            )
            cellTexts[cellTexts.length - 1].countryCodeForFlag = column.countryCodeForFlag(datum)
          }
        }

        columnBorders.push({
          // vertical border ╫
          start: { x: x - this.settings.borderThickness, y: y + opts.cellHeight - this.settings.borderThickness },
          end: { x: x - this.settings.borderThickness, y: 0 },
          thickness: this.settings.borderThickness,
          color: this.settings.borderColor
        })
        yMin = multiText.bounds.y < yMin ? multiText.bounds.y : yMin
        x = x + column.width
      }
      if (yMin < this.settings.pagePadding) {
        this.currentPage.drawLine({
          // top border ╤
          start: { x: opts.xStart - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
          end: { x: x - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
          thickness: this.settings.borderThickness,
          color: this.settings.borderColor
        })
        this.currentPage.drawLine({
          // right border ╢
          start: { x: x - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
          end: { x: x - this.settings.borderThickness, y: y + opts.cellHeight - this.settings.borderThickness },
          thickness: this.settings.borderThickness,
          color: this.settings.borderColor
        })
        this.newPage()
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
        this.drawText(text.text, text.options)
        if (text.countryCodeForFlag) {
          await this.drawFlag(text.countryCodeForFlag, {
            yStart: text.options.yStart,
            xStart: text.options.xStart + text.options.width - flagPseudoSuffixWidth,
            fontSize: text.options.fontSize
          })
        }
      }
      for (const border of columnBorders) {
        border.end.y = yMin - this.settings.borderThickness
        this.currentPage.drawLine(border)
      }
      y = yMin
      this.currentPage.drawLine({
        // horizontal border ╪
        start: { x: opts.xStart - this.settings.borderThickness, y: y - this.settings.borderThickness },
        end: { x: x - this.settings.borderThickness, y: y - this.settings.borderThickness },
        thickness: this.settings.borderThickness,
        color: this.settings.borderColor
      })
      y = y - opts.cellHeight
    }
    this.currentPage.drawLine({
      // top border ╤
      start: { x: opts.xStart - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
      end: { x: x - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
      thickness: this.settings.borderThickness,
      color: this.settings.borderColor
    })
    this.currentPage.drawLine({
      // right border ╢
      start: { x: x - this.settings.borderThickness, y: opts.yStart + opts.cellHeight - this.settings.borderThickness },
      end: { x: x - this.settings.borderThickness, y: y + opts.cellHeight - this.settings.borderThickness },
      thickness: this.settings.borderThickness,
      color: this.settings.borderColor
    })
    return y
  }
}
