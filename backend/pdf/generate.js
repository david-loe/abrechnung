
const pdf_lib = require('pdf-lib')
const pdf_fontkit = require('pdf-fontkit')
const fs = require('fs')
const i18n = require('../i18n')
const scripts = require('../common/scripts')
const Travel = require('../models/travel')


async function createDocument() {
  const pdfDoc = await pdf_lib.PDFDocument.create()
  pdfDoc.registerFontkit(pdf_fontkit)
  const fontBytes = fs.readFileSync('./common/fonts/NotoSans-Regular.ttf')
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

  const table = [{ erste: 'asdgtd', zweite: new Date(), 'dritte Spalte': 14 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }, { erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144 }]

  
  const travel = {"destinationPlace":{"country":{"name":{"en":"Afghanistan","de":"Afghanistan"},"_id":"AF","flag":"🇦🇫","currency":"AFN"},"place":"as"},"advance":{"exchangeRate":null,"amount":null,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"_id":"6492f5356fcd319e6a0e4608","name":"Test1","traveler":{"_id":"64918e8d0ab0310c7706b335","email":"professor@planetexpress.com","name":"Professor Farnsworth"},"state":"approved","editor":{"_id":"64918e8d0ab0310c7706b335","email":"professor@planetexpress.com","name":"Professor Farnsworth"},"reason":"asdf","travelInsideOfEU":false,"startDate":"2023-06-22T00:00:00.000Z","endDate":"2023-06-22T00:00:00.000Z","claimOvernightLumpSum":true,"claimSpouseRefund":false,"progress":100,"comments":[{"text":"asdfa","author":{"_id":"64918e8d0ab0310c7706b335","name":"Professor Farnsworth"},"_id":"6492f53a6fcd319e6a0e4635"}],"stages":[{"startLocation":{"country":{"name":{"en":"Burkina Faso","de":"Burkina Faso"},"_id":"BF","flag":"🇧🇫","currency":"XOF"},"place":"asd"},"endLocation":{"country":{"name":{"en":"Afghanistan","de":"Afghanistan"},"_id":"AF","flag":"🇦🇫","currency":"AFN"},"place":"aswf"},"cost":{"exchangeRate":null,"amount":12,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0},"receipts":[{"_id":"6492f56b6fcd319e6a0e465a","type":"application/pdf","name":"output.pdf"}],"date":"2023-06-20T00:00:00.000Z"},"departure":"2023-06-20T12:04:00.000Z","arrival":"2023-06-21T01:04:00.000Z","transport":"airplane","purpose":"professional","_id":"6492f56b6fcd319e6a0e465c","midnightCountries":[]},{"startLocation":{"country":{"name":{"en":"Afghanistan","de":"Afghanistan"},"_id":"AF","flag":"🇦🇫","currency":"AFN"},"place":"aswf"},"endLocation":{"country":{"name":{"en":"Pakistan","de":"Pakistan"},"_id":"PK","flag":"🇵🇰","currency":"PKR"},"place":"gagagaga"},"cost":{"exchangeRate":null,"receipts":[],"amount":15.3,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"departure":"2023-06-21T17:01:00.000Z","arrival":"2023-06-21T18:00:00.000Z","distance":51,"transport":"ownCar","purpose":"professional","_id":"6492f5f36fcd319e6a0e4697","midnightCountries":[]},{"startLocation":{"country":{"name":{"en":"Pakistan","de":"Pakistan"},"_id":"PK","flag":"🇵🇰","currency":"PKR"},"place":"gagagaga"},"endLocation":{"country":{"name":{"en":"American Samoa","de":"Amerikanisch-Samoa"},"_id":"AS","flag":"🇦🇸","currency":"USD"},"place":"agggg"},"cost":{"exchangeRate":null,"amount":23,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0},"receipts":[{"_id":"6492f63a6fcd319e6a0e46da","type":"image/png","name":"schema.png"},{"_id":"649305a034c0466080f247d4","type":"image/png","name":"airplane12.png"}],"date":"2023-06-13T00:00:00.000Z"},"departure":"2023-06-21T21:05:00.000Z","arrival":"2023-06-21T23:51:00.000Z","transport":"otherTransport","purpose":"professional","_id":"6492f63a6fcd319e6a0e46dc","midnightCountries":[]},{"startLocation":{"country":{"name":{"en":"American Samoa","de":"Amerikanisch-Samoa"},"_id":"AS","flag":"🇦🇸","currency":"USD"},"place":"agggg"},"endLocation":{"country":{"name":{"en":"Burkina Faso","de":"Burkina Faso"},"_id":"BF","flag":"🇧🇫","currency":"XOF"},"place":"asd"},"cost":{"exchangeRate":{"date":"2023-06-20T00:00:00.000Z","rate":0.127901,"amount":159.11},"amount":1244,"currency":{"name":{"de":"Renminbi Yuan","en":"renminbi-yuan"},"_id":"CNY","subunit":"Fen","symbol":"¥","flag":"🇨🇳","__v":0},"receipts":[{"_id":"6492fccd58ca92b22696535f","type":"image/png","name":"airplane12.png"}],"date":"2023-06-20T00:00:00.000Z"},"departure":"2023-06-24T12:03:00.000Z","arrival":"2023-06-24T12:03:00.000Z","transport":"shipOrFerry","purpose":"professional","_id":"6492fccd58ca92b226965361","midnightCountries":[]}],"expenses":[],"days":[{"cateringNoRefund":{"breakfast":false,"lunch":false,"dinner":false},"date":"2023-06-20T00:00:00.000Z","purpose":"professional","_id":"649305a034c0466080f247e2","refunds":[{"refund":{"amount":25,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"catering8","_id":"649305a034c0466080f247f1"},{"refund":{"amount":87,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"overnight","_id":"649305a034c0466080f24817"}],"country":{"name":{"en":"Burkina Faso","de":"Burkina Faso"},"_id":"BF","flag":"🇧🇫","currency":"XOF"}},{"cateringNoRefund":{"breakfast":false,"lunch":false,"dinner":false},"date":"2023-06-21T00:00:00.000Z","purpose":"professional","_id":"649305a034c0466080f247e3","refunds":[{"refund":{"amount":59,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"catering24","_id":"649305a034c0466080f247fd"},{"refund":{"amount":91,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"overnight","_id":"649305a034c0466080f24823"}],"country":{"name":{"en":"American Samoa","de":"Amerikanisch-Samoa"},"_id":"AS","flag":"🇦🇸","currency":"USD"}},{"cateringNoRefund":{"breakfast":false,"lunch":false,"dinner":false},"date":"2023-06-22T00:00:00.000Z","purpose":"professional","_id":"649305a034c0466080f247e4","refunds":[{"refund":{"amount":59,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"catering24","_id":"649305a034c0466080f24809"},{"refund":{"amount":91,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"overnight","_id":"649305a034c0466080f2482f"}],"country":{"name":{"en":"American Samoa","de":"Amerikanisch-Samoa"},"_id":"AS","flag":"🇦🇸","currency":"USD"}},{"cateringNoRefund":{"breakfast":false,"lunch":false,"dinner":false},"date":"2023-06-23T00:00:00.000Z","purpose":"professional","_id":"649305a034c0466080f247e5","refunds":[{"refund":{"amount":59,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"catering24","_id":"649305a034c0466080f24815"},{"refund":{"amount":91,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"overnight","_id":"649305a034c0466080f2483b"}],"country":{"name":{"en":"American Samoa","de":"Amerikanisch-Samoa"},"_id":"AS","flag":"🇦🇸","currency":"USD"}},{"cateringNoRefund":{"breakfast":false,"lunch":false,"dinner":false},"date":"2023-06-24T00:00:00.000Z","purpose":"professional","_id":"649305a034c0466080f247e6","refunds":[{"refund":{"amount":25,"currency":{"name":{"de":"Euro","en":"euro"},"_id":"EUR","subunit":"Cent","symbol":"€","flag":"🇪🇺","__v":0}},"type":"catering8","_id":"649305a034c0466080f24816"}],"country":{"name":{"en":"Burkina Faso","de":"Burkina Faso"},"_id":"BF","flag":"🇧🇫","currency":"XOF"}}],"createdAt":"2023-06-21T13:03:49.683Z","updatedAt":"2023-06-21T14:13:52.642Z","professionalShare":1,"__v":16}
  var y = getLastPage().getSize().height
  drawLogo(getLastPage(), pdfDoc, {font:font, fontSize: 16, x: 16, y: y - 32})
  y = y - edge
  y = drawGeneralTravelInformation(getLastPage(), pdfDoc, travel, { font: font, xStart: edge, yStart: y - 16, fontSize: fontSize})
  const receiptMap = getReceiptMap(travel)
  
  drawStages(getLastPage(), newPage, travel.stages, receiptMap, { font: font, xStart: edge, yStart: y - 16, fontSize: 9})
  const pdfBytes = await pdfDoc.save()
  var callback = (err) => {
    if (err) throw err;
    console.log('It\'s saved!');
  }
  fs.writeFile('output.pdf', pdfBytes, callback);
}

function drawGeneralTravelInformation(page, pdfDoc, travel, options = { font }) {
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
  drawPlace(page, pdfDoc, travel.destinationPlace, Object.assign(opts, { x: opts.xStart, y: y, prefix: i18n.t('labels.reason') + ': ' + travel.reason + '    ' + i18n.t('labels.destinationPlace') + ': ' }))

  // Dates + professionalShare
  var text = i18n.t('labels.from') + ': ' + new Date(travel.startDate).toLocaleDateString(i18n.language) + '    ' + i18n.t('labels.to') + ': ' + new Date(travel.endDate).toLocaleDateString(i18n.language)
  if(travel.professionalShare !== 1){
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

function getReceiptMap(travel){
  map = {}
  number = 1
  for(const stage of travel.stages){
    if(stage.cost && stage.cost.receipts){
      for(const receipt of stage.cost.receipts){
        receipt.number = number++
        map[receipt._id] = receipt
      }
    }
  }

  for(const expense of travel.expenses){
    if(expense.cost && expense.cost.receipts){
      for(const receipt of expense.cost.receipts){
        receipt.number = number++
        map[receipt._id] = receipt
      }
    }
  }
  return map
}

function drawStages(page, newPageFn, stages, receiptMap, options = {font}){
  const columns = []
  columns.push({ key: 'departure', width: 65, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.departure'), fn: (d) => scripts.dateTimeToString(d, i18n.language) })
  columns.push ({ key: 'arrival', width: 65, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.arrival'), fn: (d) => scripts.dateTimeToString(d, i18n.language) })
  columns.push({ key: 'startLocation', width: 150, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.startLocation'), fn: scripts.placeToString })
  columns.push({ key: 'endLocation', width: 150, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.endLocation'), fn: scripts.placeToString  })
  columns.push({ key: 'transport', width: 90, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.transport'), fn: (t) => i18n.t('labels.' + t) })
  columns.push({ key: 'distance', width: 65, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.distance') })
  columns.push({ key: 'purpose', width: 50, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.purpose'), fn: (p) => i18n.t('labels.' + p) })
  columns.push({ key: 'cost', width: 70, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.cost') , fn: (m) => scripts.getDetailedMoneyString(m, i18n.language)} )
  columns.push({ key: 'cost', width: 35, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.receiptNumber') , fn: (m) => m.receipts.map((r) => receiptMap[r._id].number)} )

  return drawTable(page, newPageFn, stages, columns, options)
}

function drawExpenses(page, newPageFn, days, receiptMap, options = {font}){
  const columns = []
  columns.push({ key: 'description', width: 165, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.description') })
  columns.push({ key: 'purpose', width: 50, alignment: pdf_lib.TextAlignment.Left, title: i18n.t('labels.purpose'), fn: (p) => i18n.t('labels.' + p) })
  columns.push({ key: 'cost', width: 70, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.cost') , fn: (m) => scripts.getDetailedMoneyString(m, i18n.language)} )
  columns.push({ key: 'cost', width: 35, alignment: pdf_lib.TextAlignment.Right, title: i18n.t('labels.receiptNumber') , fn: (m) => m.receipts.map((r) => receiptMap[r._id].number)} )

  return drawTable(page, newPageFn, days, columns, options)
}

function drawDays(page, pdfDoc, days, options = {font}){

}

async function attachReceipts(pdfDoc, receiptMap, options = {font}){
  for(const receipt of receiptMap){
    const data = receipt.data
    if(receipt.type === 'image/jpeg'){
      const image = await pdfDoc.embedJpg(data)
      page.drawImage(image, {
        x: flagX,
        y: opts.y - (opts.fontSize / 9),
        height: opts.fontSize,
        width: opts.fontSize
      }) 
    }else if(receipt.type === 'image/png'){
      const image = await pdfDoc.embedPng(data)
      page.drawImage(image, {
        x: flagX,
        y: opts.y - (opts.fontSize / 9),
        height: opts.fontSize,
        width: opts.fontSize
      })
    }else if(receipt.type == 'application/pdf'){
      const pages = await pdfDoc.embedPdf(data)
      for(const p of pages){
        page.drawPage(p, {
          ...americanFlagDims,
          x: page.getWidth() / 2 - americanFlagDims.width / 2,
          y: page.getHeight() - americanFlagDims.height - 150,
        });
      }
    }
    
    

  
  }
}


async function drawPlace(page, pdfDoc, place, options = { font, x, y }) {
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

  var filename = place.country._id
  if (opts.fontSize > 42 * 0.75) { // 0.75 px <=> 1 pt
    filename = filename + '@3x'
  } else if (opts.fontSize > 21 * 0.75) { // 0.75 px <=> 1 pt
    filename = filename + '@2x'
  }
  const flagBytes = fs.readFileSync('./pdf/flags/' + filename + '.png')
  const flag = await pdfDoc.embedPng(flagBytes)

  page.drawImage(flag, {
    x: flagX,
    y: opts.y - (opts.fontSize / 9),
    height: opts.fontSize,
    width: opts.fontSize * (3 / 2)
  })

}

async function drawLogo(page, pdfDoc, options = {font, x, y}){
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
  }else{
    filename = filename + '12'
  }
  const logoBytes = fs.readFileSync('./pdf/airplanes/' + filename + '.png')
  const logo = await pdfDoc.embedPng(logoBytes)

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
      columns.push({ key: key, width: opts.defaultCellWidth, alignment: pdf_lib.TextAlignment.Left, title: key })
    }
  }

  opts.yStart = opts.yStart - opts.cellHeight
  opts.newPageYStart = opts.newPageYStart - opts.cellHeight

  var x = opts.xStart
  var y = opts.yStart
  var firstRow = true
  for (var i = 0; i < data.length; i++) {
    x = opts.xStart
    var yMin = y
    const columnBorders = []
    const cellTexts = []
    for (const column of columns) {
      var cell = data[i][column.key]
      if(column.fn){
        cell = column.fn(cell)
      }
      if(firstRow){
        cell = column.title
      }
      if(cell == undefined){
        cell = '---'
      }
      const fontSize = firstRow ? opts.fontSize + 1 : opts.fontSize
      const multiText = pdf_lib.layoutMultilineText(cell.toString(), {
        alignment: firstRow ? pdf_lib.TextAlignment.Center : column.alignment,
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
            size: fontSize,
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
    if(firstRow){
      firstRow = false
      i--
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
  return y
}

createDocument()
