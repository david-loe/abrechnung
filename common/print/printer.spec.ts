import test from 'ava'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, TextAlignment } from 'pdf-lib'
import Formatter from '../utils/formatter.js'
import { Column, PDFDrawer } from './printer.js'
import printerSettings from './printerSettings.js'

const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8LrH8AAAAASUVORK5CYII='

function createDrawer() {
  const formatter = new Formatter('de', 'givenNameFirst')
  return PDFDrawer.create(
    { ...printerSettings, _id: 'printerSettingsId' },
    async () => null,
    async () => null,
    formatter,
    'de',
    'portrait'
  )
}

test('drawTable creates one internal link annotation per receipt number', async (t) => {
  const drawer = await createDrawer()
  const rows = [{ receiptNumbers: ['r1', 'r2'] }]
  const columns: Column<{ receiptNumbers: string[] }>[] = [
    { key: 'receiptNumbers', width: 150, alignment: TextAlignment.Left, title: 'Belegnummern' },
    {
      key: 'receiptNumbers',
      width: 100,
      alignment: TextAlignment.Left,
      title: 'Belege',
      fn: () => '1, 2',
      internalPdfLinkSegments: () => [
        { text: '1', targetId: 'r1' },
        { text: '2', targetId: 'r2' }
      ]
    }
  ]

  await drawer.drawTable(rows, columns, { xStart: 30, yStart: 700, fontSize: 9 })
  const imageData = Buffer.from(PNG_1X1_BASE64, 'base64')
  await drawer.attachReceipts({
    r1: { _id: 'r1', number: 1, date: new Date('2026-01-01'), type: 'image/png', data: new Blob([imageData]) },
    r2: { _id: 'r2', number: 2, date: new Date('2026-01-02'), type: 'image/png', data: new Blob([imageData]) }
  })

  const pdf = await PDFDocument.load(await drawer.finish())
  const reportPage = pdf.getPage(0)
  const annots = reportPage.node.Annots()
  t.truthy(annots)
  t.is(annots?.size(), 2)

  const expectedTargets = new Set([pdf.getPage(1).ref.toString(), pdf.getPage(2).ref.toString()])
  for (let i = 0; i < (annots?.size() || 0); i++) {
    const annotation = pdf.context.lookup(annots?.get(i), PDFDict)
    const action = annotation.lookup(PDFName.of('A'), PDFDict)
    t.is(action.lookup(PDFName.of('S'), PDFName).decodeText(), 'GoTo')
    const destination = action.lookup(PDFName.of('D'), PDFArray)
    const targetRef = destination.get(0)
    t.true(targetRef instanceof PDFRef)
    t.true(expectedTargets.has(targetRef.toString()))
  }
})

test('drawLink appends annotations instead of replacing existing ones', async (t) => {
  const drawer = await createDrawer()
  drawer.drawLink('https://example.org/a', { xStart: 10, yStart: 10, width: 20, height: 20 })
  drawer.drawLink('https://example.org/b', { xStart: 40, yStart: 40, width: 20, height: 20 })

  const pdf = await PDFDocument.load(await drawer.finish())
  const annots = pdf.getPage(0).node.Annots()
  t.truthy(annots)
  t.is(annots?.size(), 2)
})
