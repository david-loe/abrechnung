
const pdf_lib = require('pdf-lib')
const pdf_fontkit = require('@pdf-lib/fontkit')
const fs = require('fs')
const i18n = require('../i18n')
const scripts = require('../common/scripts')



async function createDocument() {
  const pdfDoc = await pdf_lib.PDFDocument.create()
  pdfDoc.registerFontkit(pdf_fontkit)
  const montserratBytes = fs.readFileSync('./common/fonts/Montserrat-Regular.ttf')
  const montserrat = await pdfDoc.embedFont(montserratBytes)
  const flagBytes = fs.readFileSync('./common/fonts/TwemojiCountryFlags.woff2')
  const flagFont = await pdfDoc.embedFont(flagBytes)
  const edge = 36
  const fontSize = 11
  function newPage() {
    return pdfDoc.addPage([pdf_lib.PageSizes.A4[1], pdf_lib.PageSizes.A4[0]]) // landscape page
  }
  var page = newPage()

  const table = [{ erste: 'asdgtd', zweite: new Date(), 'dritte Spalte': 14 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }]

  // drawTable(page, newPage, table, false, {font: montserrat} )
  const travel = {
    name: 'Testreise',
    traveler: { name: 'Teo Traveler' },
    state: 'refunded',
    editor: { name: 'Edi Editor' },
    reason: 'reason',
    destinationPlace: { place: 'place', country: {code: 'DE', name: {de: 'Deutschland'}, flag: scripts.getFlagEmoji('DE')} },
    travelInsideOfEU: false,
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
    advance: {
      amount: 100,
      currency: 'EUR',
    },
    claimOvernightLumpSum: true,
    stages: [{
      startDate: new Date(),
      endDate: new Date(new Date().getTime() + 3 * 60 * 60 * 1000),
      transport: 'airplane',
      startLocation: {
        country: 'DE',
        place: 'München'
      },
      endLocation: {
        country: 'SE',
        place: 'Malmö'
      },
    }]
  }
  page.drawText(' 🇩🇪 ', {font: flagFont, size: 21, x:0, y:0})
  drawGeneralTravelInformation(page, travel, { font: montserrat })
  const pdfBytes = await pdfDoc.save()
  var callback = (err) => {
    if (err) throw err;
    console.log('It\'s saved!');
  }
  fs.writeFile('output.pdf', pdfBytes, callback);
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
  delete edge

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
  page.drawText(i18n.t('labels.traveler') + ': ' + travel.traveler.name, {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  // Reason + Place
  var y = y - (opts.fontSize * 1.5)
  page.drawText(i18n.t('labels.reason') + ': ' + travel.reason + '    ' + i18n.t('labels.destinationPlace') + ': ' + scripts.placeToString(travel.destinationPlace, i18n.locale), {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  // Dates
  var y = y - (opts.fontSize * 1.5)
  page.drawText(i18n.t('labels.from') + ': ' + new Date(travel.startDate).toLocaleDateString(i18n.language) + '    ' + i18n.t('labels.to') + ': ' + new Date(travel.endDate).toLocaleDateString(i18n.language), {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
  })

  // Details
  var y = y - (opts.fontSize * 1.5)
  page.drawText(i18n.t('labels.professionalShare') + ': ' + Math.round(travel.professionalShare / 100) * 100 + '%    ', {
    x: opts.xStart,
    y: y,
    size: opts.fontSize,
    font: opts.font,
    color: opts.textColor
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
    borderThickness: 2,
    textPadding: { start: 2, bottom: 3 },
    xStart: edge,
    yStart: page.getSize().height - edge,
    newPageXStart: edge,
    newPageYStart: page.getSize().height - edge,
    minimumY: edge,
    borderColor: pdf_lib.rgb(0, 0, 0),
    textColor: pdf_lib.rgb(0, 0, 0)
  }
  Object.assign(opts, options)
  delete edge
  delete fontSize
  delete cellHeight
  delete options

  if (!columns) {
    columns = []
    for (const key in data[0]) {
      columns.push({ key: key, width: opts.defaultCellWidth, alignment: 'left', title: key })
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
      const cell = data[i][column.key]
      const multiText = pdf_lib.layoutMultilineText(cell.toString(), {
        alignment: column.alignment,
        font: opts.font,
        fontSize: opts.fontSize,
        lineHeight: opts.fontSize,
        bounds: {
          width: column.width,
          height: opts.fontSize,
          x: x,
          y: y,
        }
      })
      for (const line of multiText.lines) {
        cellTexts.push({
          text: line.text,
          options: {
            x: line.x + opts.textPadding.start,
            y: line.y + opts.textPadding.bottom,
            size: opts.fontSize,
            font: opts.font,
            color: opts.textColor
          }
        })
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
      i--
      continue
    }
    for (const text of cellTexts) {
      page.drawText(text.text, text.options)
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
}

createDocument()
