import fs from 'fs'
import pdf_fontkit from 'pdf-fontkit'
import pdf_lib from 'pdf-lib'
import Formatter from '../../common/formatter.js'
import { Locale, Money, TravelSimple } from '../../common/types.js'
import i18n from '../i18n.js'
import { Column, Options, TabelOptions, drawLogo, drawOrganisationLogo, drawPlace, drawTable } from './helper.js'

export async function generateAdvanceReport(travel: TravelSimple, language: Locale) {
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

  let y = getLastPage().getSize().height
  await drawLogo(getLastPage(), { font: font, fontSize: 16, xStart: 16, yStart: y - 32, language, formatter })
  await drawOrganisationLogo(getLastPage(), travel.project.organisation, {
    xStart: getLastPage().getSize().width - 166,
    yStart: y - 66,
    maxHeight: 50,
    maxWidth: 150
  })
  y = y - edge
  y = drawGeneralAdvanceInformation(getLastPage(), travel, {
    font: font,
    xStart: edge,
    yStart: y - 16,
    fontSize: fontSize,
    language,
    formatter
  })

  y = await drawSummary(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 10, language, formatter })

  return await pdfDoc.save()
}

function drawGeneralAdvanceInformation(page: pdf_lib.PDFPage, travel: TravelSimple, options: Options) {
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
  page.drawText(travel.name, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize * 1.5,
    font: opts.font,
    color: opts.textColor
  })

  // Traveler
  y = y - opts.fontSize * 1.5 * 1.5
  page.drawText(
    i18n.t('labels.traveler', { lng: opts.language }) +
      ': ' +
      travel.owner.name.givenName +
      ' ' +
      travel.owner.name.familyName +
      (travel.claimSpouseRefund ? ' & ' + travel.fellowTravelersNames : ''),
    {
      x: opts.xStart,
      y: y,
      size: opts.fontSize,
      font: opts.font,
      color: opts.textColor
    }
  )

  // Reason + Place
  y = y - opts.fontSize * 1.5
  drawPlace(
    page,
    travel.destinationPlace,
    Object.assign(opts, {
      yStart: y,
      prefix:
        i18n.t('labels.reason', { lng: opts.language }) +
        ': ' +
        travel.reason +
        '    ' +
        i18n.t('labels.destinationPlace', { lng: opts.language }) +
        ': '
    })
  )

  // Dates
  let text =
    i18n.t('labels.from', { lng: opts.language }) +
    ': ' +
    options.formatter.date(travel.startDate) +
    '    ' +
    i18n.t('labels.to', { lng: opts.language }) +
    ': ' +
    options.formatter.date(travel.endDate)
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

async function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: TravelSimple, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 100, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'sum',
    width: 180,
    alignment: pdf_lib.TextAlignment.Right,
    title: 'sum',
    fn: (m: Money) => options.formatter.detailedMoney(m, true)
  })

  const summary = []
  summary.push({ reference: i18n.t('labels.total', { lng: options.language }), sum: travel.advance })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.advance', { lng: options.language }), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  const tabelOptions: TabelOptions = options
  tabelOptions.yStart -= fontSize * 1.25
  tabelOptions.firstRow = false

  const y = (await drawTable(page, newPageFn, summary, columns, tabelOptions)) - 16

  page.drawText(
    i18n.t('report.advance.approvedXY', {
      lng: options.language,
      X: options.formatter.date(travel.updatedAt),
      Y: travel.editor.name.givenName + ' ' + travel.editor.name.familyName
    }),
    {
      x: options.xStart,
      y: y - fontSize,
      size: fontSize,
      font: options.font,
      color: options.textColor
    }
  )
  return y
}
