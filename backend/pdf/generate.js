
const pdf_lib = require('pdf-lib')
const fs = require('fs');

async function createDocument() {
  const pdfDoc = await pdf_lib.PDFDocument.create()
  const helvetica = await pdfDoc.embedFont(pdf_lib.StandardFonts.Helvetica)
  const edge = 36
  const fontSize = 11
  const page = pdfDoc.addPage([pdf_lib.PageSizes.A4[1], pdf_lib.PageSizes.A4[0]] ) // landscape page
  const { width, height } = page.getSize()
  console.log(width)
  const cellWidth = 100
  const cellHeight = fontSize * 1.5
  const borderThickness = 1
  const textHeightLift = 3
  
  const table = [{erste: 'asdgtd', zweite: new Date(), 'dritte Spalte': 14}, {erste: 'Mein Name ist', zweite: new Date(), 'dritte Spalte': 144}]
  
  const xStart = edge
  var x = xStart
  const yStart = height - (edge + cellHeight)
  var y = yStart

  for(const row of table){
    x = xStart
    for(const column in row){
      const cell = row[column]

      const multiText = pdf_lib.layoutMultilineText(cell.toString(), {
        alignment: 'left', 
        font: helvetica,
        fontSize: fontSize,  
        lineHeight: cellHeight,
        bounds: { width: cellWidth, height: 10000 }
      })
      
      page.drawText(cell.toString(), {
        x: x,
        y: y + textHeightLift,
        size: fontSize,
        font: helvetica,
        color: pdf_lib.rgb(0, 0, 0),
        maxWidth: cellWidth
      })
      x = x + cellWidth
      page.drawLine({
        start: {x: x - borderThickness, y: y + cellHeight - borderThickness},
        end: {x: x - borderThickness, y: y - borderThickness},
        thickness: borderThickness,
        color: pdf_lib.rgb(0, 0, 0),
      })
    }
    page.drawLine({
      start: {x: xStart - borderThickness, y: y - borderThickness},
      end: {x: x - borderThickness, y: y - borderThickness},
      thickness: borderThickness,
      color: pdf_lib.rgb(0, 0, 0),
    })
    y = y - cellHeight
  }
  page.drawLine({
    start: {x: xStart - borderThickness, y: yStart + cellHeight - borderThickness},
    end: {x: x - borderThickness, y: yStart + cellHeight - borderThickness},
    thickness: borderThickness,
    color: pdf_lib.rgb(0, 0, 0),
  })
  page.drawLine({
    start: {x: xStart - borderThickness, y: yStart + cellHeight - borderThickness},
    end: {x: xStart - borderThickness, y: y + cellHeight - borderThickness},
    thickness: borderThickness,
    color: pdf_lib.rgb(0, 0, 0),
  })


  const pdfBytes = await pdfDoc.save()
  var callback = (err) => {
    if (err) throw err;
    console.log('It\'s saved!');
  }
  fs.writeFile('output.pdf', pdfBytes, callback);

  
}


createDocument()
