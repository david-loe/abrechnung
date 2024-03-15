import pdf_lib from 'pdf-lib'
import pdf_fontkit from 'pdf-fontkit'
import fs from 'fs'
import i18n from '../i18n.js'
import { getDetailedMoneyString } from '../../common/scripts.js'
import { Locale, Money, TravelSimple } from '../../common/types.js'
import { Column, Options, TabelOptions, drawTable, drawLogo, drawPlace } from './helper.js'

export async function generateAdvanceReport(travel: TravelSimple) {
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
  y = drawGeneralAdvanceInformation(getLastPage(), travel, { font: font, xStart: edge, yStart: y - 16, fontSize: fontSize })

  y = drawSummary(getLastPage(), newPage, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: 10 })

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
    i18n.t('labels.traveler') +
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
  var y = y - opts.fontSize * 1.5
  drawPlace(
    page,
    travel.destinationPlace,
    Object.assign(opts, {
      yStart: y,
      prefix: i18n.t('labels.reason') + ': ' + travel.reason + '    ' + i18n.t('labels.destinationPlace') + ': '
    })
  )

  // Dates
  var text =
    i18n.t('labels.from') +
    ': ' +
    new Date(travel.startDate).toLocaleDateString(i18n.language) +
    '    ' +
    i18n.t('labels.to') +
    ': ' +
    new Date(travel.endDate).toLocaleDateString(i18n.language)
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

function drawSummary(page: pdf_lib.PDFPage, newPageFn: () => pdf_lib.PDFPage, travel: TravelSimple, options: Options) {
  const columns: Column[] = []
  columns.push({ key: 'reference', width: 100, alignment: pdf_lib.TextAlignment.Left, title: 'reference' })
  columns.push({
    key: 'sum',
    width: 180,
    alignment: pdf_lib.TextAlignment.Right,
    title: 'sum',
    fn: (m: Money) => getDetailedMoneyString(m, i18n.language as Locale, true)
  })

  const summary = []
  summary.push({ reference: i18n.t('labels.total'), sum: travel.advance })

  const fontSize = options.fontSize + 2
  page.drawText(i18n.t('labels.advance'), {
    x: options.xStart,
    y: options.yStart - fontSize,
    size: fontSize,
    font: options.font,
    color: options.textColor
  })
  const tabelOptions: TabelOptions = options
  tabelOptions.yStart -= fontSize * 1.25
  tabelOptions.firstRow = false

  const y = drawTable(page, newPageFn, summary, columns, tabelOptions) - 16

  page.drawText(
    i18n.t('report.advance.approvedXY', {
      X: (travel.updatedAt as Date).toLocaleDateString(i18n.language),
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
