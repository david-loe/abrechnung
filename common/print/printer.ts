import pdf_fontkit from 'pdf-fontkit'
import { Color, componentsToColor, PDFDocument, PDFFont, PDFImage, PDFPage, PDFString, rgb, TextAlignment } from 'pdf-lib'
import fontsBASE64 from '../fonts/base64.json' with { type: 'json' }
import {
  _id,
  BadgeStyle,
  binary,
  CountryCode,
  CountrySimple,
  DocumentFileType,
  Locale,
  PageOrientation,
  PrinterSettings,
  PrintSettingsBase
} from '../types.js'
import Formatter from '../utils/formatter.js'
import { hexToRGB } from '../utils/scripts.js'
import { embedBootstrapIconFont, getBootstrapIconGlyph } from './bootstrapIcons.js'
import flagsPNG from './flags.json' with { type: 'json' }
import { embedFontWithMetrics, getTextMetrics } from './fontMetrics.js'

export interface PrintSettings extends PrintSettingsBase {
  language: Locale
  defaultPageOrientation: PageOrientation
}

interface PrintSettingsWithColorObjects extends Omit<PrintSettings, 'textColor' | 'borderColor'> {
  textColor: Color
  borderColor: Color
}

export interface Options {
  fontSize: number
  xStart: number
  /** Upper edge of the text or layout area, in PDF coordinates (Y increases upwards). */
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
  alignment: TextAlignment
  title: string
  // biome-ignore lint/suspicious/noExplicitAny: typing to complex
  fn?: (p: any) => string
  // biome-ignore lint/suspicious/noExplicitAny: typing to complex
  countryCodeForFlag?: (p: any) => CountryCode
  // biome-ignore lint/suspicious/noExplicitAny: typing to complex
  internalPdfLinkSegments?: (p: any) => { text: string; targetId: string }[]
}

interface ReceiptMapEntry<idType extends _id, dataType extends binary = binary> {
  number: number
  date: Date
  noNumberPrint?: boolean
  _id: idType
  type: DocumentFileType
  data?: dataType
}
export interface ReceiptMap<idType extends _id> {
  [key: string]: ReceiptMapEntry<idType>
}

export class Printer<idType extends _id> {
  formatter: Formatter
  settings: PrinterSettings
  getDocumentFileBufferById: PDFDrawer<idType>['getDocumentFileBufferById']
  getOrganisationLogoIdById: PDFDrawer<idType>['getOrganisationLogoIdById']
  translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string

  constructor(
    settings: PrinterSettings,
    formatter: Formatter,
    translateFunc: (textIdentifier: string, language: Locale, interpolation?: Record<string, string>) => string,
    getDocumentFileBufferById: PDFDrawer<idType>['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer<idType>['getOrganisationLogoIdById']
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
const splitOutLines = (input: string, maxWidth: number, font: PDFFont, fontSize: number) => {
  const fullWidth = font.widthOfTextAtSize(input, fontSize)
  if (fullWidth <= maxWidth) {
    return { line: input, width: fullWidth, remainder: undefined }
  }

  const characters = Array.from(input)
  let start = 1
  let end = characters.length
  while (start < end) {
    const middle = Math.ceil((start + end) / 2)
    const width = font.widthOfTextAtSize(characters.slice(0, middle).join(''), fontSize)
    if (width <= maxWidth) start = middle
    else end = middle - 1
  }

  const fittingText = characters.slice(0, start).join('')
  const whitespace = /\s/u.test(input[fittingText.length] ?? '') ? fittingText.length : lastIndexOfWhitespace(fittingText)
  const line = whitespace ? fittingText.slice(0, whitespace) : fittingText
  return { line, width: font.widthOfTextAtSize(line, fontSize), remainder: input.slice(line.length) || undefined }
}

// Every line stores its upper edge. Only drawText converts it to a PDF baseline.
const layoutMultilineText = (
  text: string,
  { alignment, fontSize, font, width, xStart, yStart }: Options & { alignment: TextAlignment; font: PDFFont; width: number }
) => {
  const lineHeight = getTextMetrics(font, fontSize).height
  const textLines: { text: string; width: number; x: number; y: number }[] = []
  for (const inputLine of lineSplit(cleanText(text))) {
    let remainder: string | undefined = inputLine
    while (remainder !== undefined) {
      const line = splitOutLines(remainder, width, font, fontSize)
      const x =
        alignment === TextAlignment.Center
          ? xStart + (width - line.width) / 2
          : alignment === TextAlignment.Right
            ? xStart + width - line.width
            : xStart
      textLines.push({ text: line.line, width: line.width, x, y: yStart - textLines.length * lineHeight })
      // Preserve whitespace in explicit lines, trimming only automatically wrapped remainders.
      remainder = line.remainder?.trim() || undefined
    }
  }
  return { lines: textLines, height: textLines.length * lineHeight }
}

const FLAG_PSEUDO_SUFFIX = 'mim'
export const EMPTY_CELL = '---'

export class PDFDrawer<idType extends _id> {
  font: PDFFont
  bootstrapIconFont: PDFFont
  doc: PDFDocument
  formatter: Formatter
  settings: PrintSettingsWithColorObjects
  currentPage!: PDFPage
  pendingInternalLinks: { page: PDFPage; targetId: string; xStart: number; yStart: number; width: number; height: number }[] = []
  getDocumentFileBufferById: (id: idType) => Promise<{ buffer: ArrayBuffer; type: DocumentFileType } | null>
  getOrganisationLogoIdById: (id: idType) => Promise<{ logoId: idType; website?: string | null } | null>

  constructor(
    settings: PrintSettings,
    doc: PDFDocument,
    getDocumentFileBufferById: PDFDrawer<idType>['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer<idType>['getOrganisationLogoIdById'],
    font: PDFFont,
    bootstrapIconFont: PDFFont,
    formatter: Formatter
  ) {
    this.doc = doc
    this.font = font
    this.bootstrapIconFont = bootstrapIconFont
    this.formatter = formatter
    this.settings = {
      ...settings,
      textColor: componentsToColor(hexToRGB(settings.textColor), 0.00390625) || rgb(0, 0, 0),
      borderColor: componentsToColor(hexToRGB(settings.borderColor), 0.00390625) || rgb(0, 0, 0)
    }
    this.getDocumentFileBufferById = getDocumentFileBufferById
    this.getOrganisationLogoIdById = getOrganisationLogoIdById
    this.formatter.setLocale(this.settings.language)
    this.newPage()
  }

  static async create<idType extends _id>(
    settings: PrinterSettings,
    getDocumentFileBufferById: PDFDrawer<idType>['getDocumentFileBufferById'],
    getOrganisationLogoIdById: PDFDrawer<idType>['getOrganisationLogoIdById'],
    formatter: Formatter,
    language: Locale,
    defaultPageOrientation: PageOrientation
  ) {
    const doc = await PDFDocument.create()
    doc.registerFontkit(pdf_fontkit)
    const [font, bootstrapIconFont] = await Promise.all([
      embedFontWithMetrics(doc, fontsBASE64[settings.fontName]),
      embedBootstrapIconFont(doc)
    ])
    const printSettings = { ...settings, language, defaultPageOrientation }
    return new PDFDrawer(printSettings, doc, getDocumentFileBufferById, getOrganisationLogoIdById, font, bootstrapIconFont, formatter)
  }

  async finish() {
    return (await this.doc.save()) as Uint8Array<ArrayBuffer>
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

  /** Draw from the first line's upper edge and return the text block's lower edge, including descenders. */
  drawMultilineText(text: string, options: Options & { alignment?: TextAlignment; width?: number }) {
    const opts = {
      alignment: TextAlignment.Left,
      width: this.currentPage.getSize().width - this.settings.pagePadding - options.xStart,
      ...options
    }
    const multiLineText = layoutMultilineText(text, {
      alignment: opts.alignment,
      font: this.font,
      fontSize: opts.fontSize,
      width: opts.width,
      xStart: opts.xStart,
      yStart: opts.yStart
    })
    for (const line of multiLineText.lines) {
      this.drawText(line.text, { xStart: line.x, yStart: line.y, fontSize: opts.fontSize })
    }
    return opts.yStart - multiLineText.height
  }

  /** Like drawMultilineText, with a flag centered in the final text line. */
  async drawMultilineTextWithPlace(
    text: string,
    place: { country: CountrySimple; place?: string },
    options: Options & { alignment?: TextAlignment; width?: number }
  ) {
    let textWithPlace = text
    const opts = {
      alignment: TextAlignment.Left,
      width: this.currentPage.getSize().width - this.settings.pagePadding - options.xStart,
      ...options
    }
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
      width: opts.width,
      xStart: opts.xStart,
      yStart: opts.yStart
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
    return opts.yStart - multiLineText.height
  }

  /** Draw from the text's upper edge and return its lower edge, including descenders. */
  drawText(text: string, options: Options & { color?: Color }, font = this.font) {
    const { height, ascent } = getTextMetrics(font, options.fontSize)
    this.currentPage.drawText(text, {
      x: options.xStart,
      y: options.yStart - ascent,
      size: options.fontSize,
      font,
      color: options.color ?? this.settings.textColor
    })
    return options.yStart - height
  }

  /** yStart is the text's upper edge; the background extends by padding. Returns the background's lower edge. */
  drawBadge(text: string, style: BadgeStyle, options: Options & { width?: number; padding?: { x: number; y: number } }) {
    const paddingX = options.padding?.x ?? 3
    const paddingY = options.padding?.y ?? 2
    const top = options.yStart + paddingY
    const maxWidth = options.width ?? this.currentPage.getWidth() - this.settings.pagePadding - options.xStart
    const layout = layoutMultilineText(text.replace(/\s+/gu, ' ').trim(), {
      alignment: TextAlignment.Left,
      font: this.font,
      fontSize: options.fontSize,
      xStart: options.xStart + paddingX,
      yStart: options.yStart,
      width: maxWidth - 2 * paddingX
    })
    const width = Math.min(maxWidth, Math.max(0, ...layout.lines.map((line) => line.width)) + 2 * paddingX)
    const height = layout.height + 2 * paddingY
    const radius = Math.min(3, width / 2, height / 2)
    const background = hexToRGB(style.color).map((component) => component / 255)
    this.currentPage.drawSvgPath(
      `M ${radius} 0 H ${width - radius} Q ${width} 0 ${width} ${radius} V ${height - radius} Q ${width} ${height} ${width - radius} ${height} H ${radius} Q 0 ${height} 0 ${height - radius} V ${radius} Q 0 0 ${radius} 0 Z`,
      { x: options.xStart, y: top, color: rgb(background[0], background[1], background[2]), borderWidth: 0 }
    )
    const foreground = style.text === 'white' ? 1 : 0
    for (const line of layout.lines) {
      this.drawText(line.text, {
        xStart: line.x,
        yStart: line.y,
        fontSize: options.fontSize,
        color: rgb(foreground, foreground, foreground)
      })
    }
    return top - height
  }

  drawReceiptNumber(receipt: ReceiptMapEntry<idType>) {
    if (receipt.noNumberPrint) {
      return
    }
    const text = `#${receipt.number}${receipt.date ? ` - ${this.formatter.date(receipt.date)}` : ''}`
    const width = this.font.widthOfTextAtSize(text, this.settings.fontSizes.L)
    const height = getTextMetrics(this.font, this.settings.fontSizes.L).height
    this.currentPage.drawRectangle({
      x: 2,
      y: this.currentPage.getHeight() - height - 4,
      width: width,
      height: height + 4,
      color: rgb(1, 1, 1), //white
      opacity: 0.5
    })
    this.drawText(text, { xStart: 2, yStart: this.currentPage.getHeight() - 2, fontSize: this.settings.fontSizes.L })
  }

  async attachReceipts(receiptMap: ReceiptMap<idType>) {
    const receiptFirstPageMap: Record<string, PDFPage> = {}
    for (const receiptId in receiptMap) {
      const receipt = receiptMap[receiptId]
      let doc: { buffer: ArrayBuffer; type: DocumentFileType } | null = null
      if (receipt.data && receipt.data instanceof Blob) {
        doc = { buffer: await receipt.data.arrayBuffer(), type: receipt.type }
      } else {
        doc = await this.getDocumentFileBufferById(receipt._id)
      }

      if (!doc) {
        console.error(`No DocumentFile found for id: ${receipt._id}`)
        continue
      }
      try {
        let firstPageOfReceipt: PDFPage | null = null
        if (receipt.type === 'application/pdf') {
          const insertPDF = await PDFDocument.load(doc.buffer)
          const pages = await this.doc.copyPages(insertPDF, insertPDF.getPageIndices())
          for (const p of pages) {
            this.currentPage = this.doc.addPage(p)
            if (!firstPageOfReceipt) {
              firstPageOfReceipt = this.currentPage
            }
            this.drawReceiptNumber(receipt)
          }
        } else {
          let image: PDFImage
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
          firstPageOfReceipt = this.currentPage
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
        if (firstPageOfReceipt) {
          receiptFirstPageMap[receipt._id.toString()] = firstPageOfReceipt
        }
      } catch (error) {
        console.error(`Error while trying to add Document (${receipt._id})[${doc.type}] to PDF: ${error}`)
      }
    }
    for (const link of this.pendingInternalLinks) {
      const targetPage = receiptFirstPageMap[link.targetId]
      if (!targetPage) {
        continue
      }
      const linkAnnotation = this.doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [link.xStart, link.yStart - link.height, link.xStart + link.width, link.yStart],
        Border: [0, 0, 0],
        C: [0, 0, 1],
        A: { Type: 'Action', S: 'GoTo', D: [targetPage.ref, 'Fit'] }
      })
      const linkAnnotationRef = this.doc.context.register(linkAnnotation)
      link.page.node.addAnnot(linkAnnotationRef)
    }
    this.pendingInternalLinks = []
  }

  /** yStart is the associated text line's upper edge; center the flag within its full font height. */
  async drawFlag(countryCode: CountryCode, options: Options) {
    const opts = options

    let filename = countryCode as keyof typeof flagsPNG
    if (opts.fontSize > 42 * 0.75) {
      // 0.75 px <=> 1 pt
      filename = `${filename}@3x` as keyof typeof flagsPNG
    } else if (opts.fontSize > 21 * 0.75) {
      // 0.75 px <=> 1 pt
      filename = `${filename}@2x` as keyof typeof flagsPNG
    }
    const flag = await this.doc.embedPng(flagsPNG[filename])

    this.currentPage.drawImage(flag, {
      x: opts.xStart,
      y: opts.yStart - (getTextMetrics(this.font, opts.fontSize).height + opts.fontSize) / 2,
      height: opts.fontSize,
      width: opts.fontSize * (3 / 2)
    })
  }

  /**
   * Oben links (xStart, yStart)
   */
  drawLogo(title: string, options: Options) {
    return this.drawIconLabel(['receipt'], title, options)
  }

  drawIconLabel(iconNames: string[], label: string, options: Options) {
    const glyphs = iconNames.map(getBootstrapIconGlyph).filter((glyph) => glyph !== undefined)
    const textHeight = getTextMetrics(this.font, options.fontSize).height
    const iconHeight = glyphs.length > 0 ? getTextMetrics(this.bootstrapIconFont, options.fontSize).height : 0
    const lineHeight = Math.max(textHeight, iconHeight)
    const textY = options.yStart - (lineHeight - textHeight) / 2
    const iconY = options.yStart - (lineHeight - iconHeight) / 2

    let x = options.xStart
    for (const glyph of glyphs) {
      this.drawText(glyph, { xStart: x, yStart: iconY, fontSize: options.fontSize }, this.bootstrapIconFont)
      x += this.bootstrapIconFont.widthOfTextAtSize(glyph, options.fontSize) + options.fontSize / 3
    }
    this.drawText(label, { xStart: x, yStart: textY, fontSize: options.fontSize })

    return options.yStart - lineHeight
  }

  /** Place the logo at the upper right of the area starting at (xStart, yStart). */
  async drawOrganisationLogo(organisationId: idType, options: { xStart: number; yStart: number; maxWidth: number; maxHeight: number }) {
    const orga = await this.getOrganisationLogoIdById(organisationId)
    if (!orga) {
      return
    }
    const doc = await this.getDocumentFileBufferById(orga.logoId)
    if (!doc) {
      console.error(`No DocumentFile found for id: ${orga.logoId}`)
      return
    }

    let image: PDFImage
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
    const y = options.yStart - size.height

    if (orga.website) {
      this.drawLink(orga.website, { xStart: x, yStart: options.yStart, width: size.width, height: size.height })
    }
    this.currentPage.drawImage(image, { x: x, y: y, width: size.width, height: size.height })
  }

  /** yStart is the upper edge of the clickable rectangle. */
  drawLink(url: string, options: { xStart: number; yStart: number; width: number; height: number }) {
    const linkAnnotation = this.doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [options.xStart, options.yStart - options.height, options.xStart + options.width, options.yStart],
      Border: [0, 0, 0],
      C: [0, 0, 1],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) }
    })
    const linkAnnotationRef = this.doc.context.register(linkAnnotation)
    this.currentPage.node.addAnnot(linkAnnotationRef)
  }

  /** Draw from the table's upper edge and return its lower edge on the final page, without extra spacing. */
  async drawTable<Type extends {}>(data: Type[], columns: Column<Type>[], options: TableOptions) {
    if (data.length === 0) return options.yStart
    const opts = { cellHeight: options.fontSize * 1.5, firstRow: true, ...options }
    // cellPadding.bottom is the last baseline's inset, as in the original table layout.
    const paddingTop = opts.fontSize / 4
    const flagPseudoSuffixWidth =
      this.font.widthOfTextAtSize(FLAG_PSEUDO_SUFFIX, opts.fontSize) - this.font.widthOfTextAtSize(' ', opts.fontSize)
    let y = opts.yStart
    let xStart = opts.xStart
    let onFreshPage = y === this.currentPage.getHeight() - this.settings.pagePadding
    for (let i = opts.firstRow ? -1 : 0; i < data.length; i++) {
      const isHeader = i === -1
      let x = xStart
      let rowHeight = opts.cellHeight
      const cellTexts: { text: string; options: Options & { width: number }; countryCodeForFlag?: CountryCode }[] = []
      const cellLinks: { targetId: string; xStart: number; yStart: number; width: number; height: number }[] = []
      const borders = [xStart]
      for (const column of columns) {
        const datum = isHeader ? undefined : data[i][column.key]
        let cell = column.title
        if (!isHeader) cell = datum === undefined ? EMPTY_CELL : column.fn ? column.fn(datum) : String(datum)
        const countryCodeForFlag = !isHeader && datum !== undefined ? column.countryCodeForFlag?.(datum) : undefined
        const fontSize = isHeader ? opts.fontSize + 1 : opts.fontSize
        const { descent } = getTextMetrics(this.font, fontSize)
        const paddingBottom = Math.max(0, this.settings.cellPadding.bottom - descent)
        const layout = layoutMultilineText(cell + (countryCodeForFlag ? FLAG_PSEUDO_SUFFIX : ''), {
          alignment: isHeader ? TextAlignment.Center : column.alignment,
          font: this.font,
          fontSize,
          width: column.width - this.settings.cellPadding.x * 3,
          xStart: x + this.settings.cellPadding.x,
          yStart: y - paddingTop
        })
        rowHeight = Math.max(rowHeight, layout.height + paddingTop + paddingBottom)
        for (const line of layout.lines) {
          cellTexts.push({ text: line.text, options: { xStart: line.x, yStart: line.y, width: line.width, fontSize } })
        }
        if (!isHeader && datum !== undefined && column.internalPdfLinkSegments) {
          const segments = column.internalPdfLinkSegments(datum)
          let segmentIndex = 0
          for (const line of layout.lines) {
            let lineSearchIndex = 0
            while (segmentIndex < segments.length) {
              const segment = segments[segmentIndex]
              const segmentTextIndex = line.text.indexOf(segment.text, lineSearchIndex)
              if (segmentTextIndex === -1) break
              const prefix = line.text.slice(0, segmentTextIndex)
              cellLinks.push({
                targetId: segment.targetId,
                xStart: line.x + this.font.widthOfTextAtSize(prefix, fontSize),
                yStart: line.y,
                width: this.font.widthOfTextAtSize(segment.text, fontSize),
                height: getTextMetrics(this.font, fontSize).height
              })
              lineSearchIndex = segmentTextIndex + segment.text.length
              segmentIndex++
            }
          }
        }
        if (countryCodeForFlag && layout.lines.length > 0) {
          const lastText = cellTexts[cellTexts.length - 1]
          lastText.text = lastText.text.slice(0, -FLAG_PSEUDO_SUFFIX.length)
          lastText.countryCodeForFlag = countryCodeForFlag
        }
        x += column.width
        borders.push(x)
      }
      const bottom = y - rowHeight
      // Keep rows together. An oversized row is drawn once on a fresh page, as before.
      if (bottom < this.settings.pagePadding && !onFreshPage) {
        this.newPage()
        xStart = this.settings.pagePadding
        y = this.currentPage.getHeight() - this.settings.pagePadding
        onFreshPage = true
        i--
        continue
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
      for (const link of cellLinks) this.pendingInternalLinks.push({ page: this.currentPage, ...link })
      const lineStyle = { thickness: this.settings.borderThickness, color: this.settings.borderColor }
      if (i === (opts.firstRow ? -1 : 0) || onFreshPage) {
        this.currentPage.drawLine({ start: { x: xStart, y }, end: { x, y }, ...lineStyle })
      }
      for (const borderX of borders) {
        this.currentPage.drawLine({ start: { x: borderX, y }, end: { x: borderX, y: bottom }, ...lineStyle })
      }
      this.currentPage.drawLine({ start: { x: xStart, y: bottom }, end: { x, y: bottom }, ...lineStyle })
      y = bottom
      onFreshPage = false
    }
    return y
  }
}
