import { readFileSync } from 'node:fs'
import { mock } from 'node:test'
import test from 'ava'
import fontkit from 'pdf-fontkit'
import { decodeFromBase64DataUri, PDFArray, PDFContentStream, PDFDict, PDFDocument, PDFName, PDFRef, TextAlignment } from 'pdf-lib'
import fontsBASE64 from '../fonts/base64.json' with { type: 'json' }
import Formatter from '../utils/formatter.js'
import { Column, PDFDrawer } from './printer.js'
import printerSettings from './printerSettings.js'

const PNG_1X1_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8LrH8AAAAASUVORK5CYII='

const testFonts = {
  Inter: fontkit.create(decodeFromBase64DataUri(fontsBASE64.Inter)),
  NotoSans: fontkit.create(decodeFromBase64DataUri(fontsBASE64.NotoSans)),
  BootstrapIcons: fontkit.create(readFileSync(new URL(import.meta.resolve('bootstrap-icons/font/fonts/bootstrap-icons.woff'))))
}

function fontMetrics(fontName: keyof typeof testFonts, fontSize: number) {
  const font = testFonts[fontName]
  const ascent = (font.ascent / font.unitsPerEm) * fontSize
  const descent = (-font.descent / font.unitsPerEm) * fontSize
  return { ascent, descent, height: ascent + descent }
}

function createDrawer(fontName: 'Inter' | 'NotoSans' = printerSettings.fontName) {
  const formatter = new Formatter('de', 'givenNameFirst')
  return PDFDrawer.create(
    { ...printerSettings, fontName, _id: 'printerSettingsId' },
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

  const rendered = mock.method(drawer.currentPage, 'drawText')
  t.teardown(() => rendered.mock.restore())
  await drawer.drawTable(rows, columns, { xStart: 30, yStart: 700, fontSize: 9 })
  const receiptText = rendered.mock.calls.find(({ arguments: [text] }) => text === '1, 2')?.arguments[1]
  if (!receiptText) throw new Error('Missing receipt numbers')
  for (const link of drawer.pendingInternalLinks) {
    t.true(Math.abs(link.yStart - ((receiptText.y ?? 0) + fontMetrics('Inter', 9).ascent)) < 1e-6)
    t.is(link.height, fontMetrics('Inter', 9).height)
  }
  const linkRectangles = drawer.pendingInternalLinks.map((link) => [
    link.xStart,
    link.yStart - link.height,
    link.xStart + link.width,
    link.yStart
  ])
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
    t.deepEqual(annotation.lookup(PDFName.of('Rect'), PDFArray).asArray().map(String), linkRectangles[i].map(String))
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
  for (const [index, expected] of [
    [10, -10, 30, 10],
    [40, 20, 60, 40]
  ].entries()) {
    const annotation = pdf.context.lookup(annots?.get(index), PDFDict)
    t.deepEqual(annotation.lookup(PDFName.of('Rect'), PDFArray).asArray().map(String), expected.map(String))
  }
})

test('drawBadge uses category colors, rounded corners and bounded multiline text', async (t) => {
  const drawer = await createDrawer()
  const calls: { text: string; x: number; y: number }[] = []
  const drawText = drawer.currentPage.drawText.bind(drawer.currentPage)
  drawer.currentPage.drawText = (text, options) => {
    calls.push({ text, x: options?.x ?? 0, y: options?.y ?? 0 })
    return drawText(text, options)
  }
  const top = 700
  const bottom = drawer.drawBadge(
    `Long category with spaces ${'A'.repeat(80)}`,
    { color: '#336699', text: 'white' },
    { xStart: 30, yStart: top, fontSize: 11, width: 150 }
  )
  t.true(calls.length > 2)
  t.true(bottom < top - 30)
  for (const call of calls) {
    t.true(call.x >= 30)
    t.true(call.x + drawer.font.widthOfTextAtSize(call.text, 11) <= 180)
    t.true(call.y > bottom)
  }
  drawer.drawBadge('Black text', { color: '#fff', text: 'black' }, { xStart: 200, yStart: top, fontSize: 11 })
  const contents = drawer.currentPage.node.Contents()
  if (!(contents instanceof PDFArray)) throw new Error('Missing page content array')
  const contentStream = drawer.doc.context.lookup(contents.get(0))
  if (!(contentStream instanceof PDFContentStream)) throw new Error('Missing drawing operators')
  const stream = contentStream.getContentsString()
  t.true(stream.includes('0.2 0.4 0.6 rg'))
  t.true(stream.includes('1 1 1 rg'))
  t.true(stream.includes('0 0 0 rg'))
  t.regex(stream, / [cv]\n/)
  t.true((await drawer.finish()).length > 0)
})

test('multiline text and badges share wrapping for exact fits and overlong words', async (t) => {
  const drawer = await createDrawer()
  const lines: string[] = []
  const drawText = drawer.currentPage.drawText.bind(drawer.currentPage)
  drawer.currentPage.drawText = (text, options) => {
    lines.push(text)
    return drawText(text, options)
  }
  const exactFit = 'Fits exactly'
  for (const input of [exactFit, `Words before ${'Ü'.repeat(80)} and after`]) {
    lines.length = 0
    const width = input === exactFit ? drawer.font.widthOfTextAtSize(input, 11) : 140
    drawer.drawMultilineText(input, { xStart: 30, yStart: 700, fontSize: 11, width })
    const textLines = [...lines]
    for (const line of textLines) t.true(drawer.font.widthOfTextAtSize(line, 11) <= width)
    t.is(textLines.join('').replace(/\s/gu, ''), input.replace(/\s/gu, ''))
    if (input === exactFit) t.deepEqual(textLines, [input])
    else t.true(textLines.length > 2)

    lines.length = 0
    const padding = { x: 3, y: 2 }
    drawer.drawBadge(
      input,
      { color: '#336699', text: 'white' },
      { xStart: 30, yStart: 600, fontSize: 11, width: width + 2 * padding.x, padding }
    )
    t.deepEqual(lines, textLines)
  }
})

test('multiline text preserves explicit blank lines and makes progress with widths smaller than a character', async (t) => {
  const drawer = await createDrawer()
  const lines: string[] = []
  const drawText = drawer.currentPage.drawText.bind(drawer.currentPage)
  drawer.currentPage.drawText = (text, options) => {
    lines.push(text)
    return drawText(text, options)
  }
  drawer.drawMultilineText(' first line\n\nlast line ', { xStart: 30, yStart: 700, fontSize: 11, width: 300 })
  t.deepEqual(lines, [' first line', '', 'last line '])
  lines.length = 0
  drawer.drawMultilineText('ABC', { xStart: 30, yStart: 600, fontSize: 11, width: 1 })
  t.deepEqual(lines, ['A', 'B', 'C'])
})

test('multiline text discards whitespace-only wrapped remainders while preserving explicit blank lines', async (t) => {
  const drawer = await createDrawer()
  const rendered = mock.method(drawer.currentPage, 'drawText')
  t.teardown(() => rendered.mock.restore())
  const fontSize = 11
  const width = drawer.font.widthOfTextAtSize('ABC', fontSize)
  const height = fontMetrics('Inter', fontSize).height
  for (const [input, expected] of [
    ['ABC   ', ['ABC']],
    ['ABC   \n', ['ABC', '']],
    ['ABC   \n\nABC', ['ABC', '', 'ABC']]
  ] as const) {
    rendered.mock.resetCalls()
    const bottom = drawer.drawMultilineText(input, { xStart: 30, yStart: 700, fontSize, width })
    t.deepEqual(
      rendered.mock.calls.map(({ arguments: [text] }) => text),
      [...expected]
    )
    t.is(bottom, 700 - expected.length * height)
  }
})

test('badge text keeps its upper edge for different paddings and its background contains every line', async (t) => {
  const drawer = await createDrawer()
  const lines: { text: string; x: number; y: number }[] = []
  const backgrounds: number[] = []
  const drawText = drawer.currentPage.drawText.bind(drawer.currentPage)
  const drawBackground = drawer.currentPage.drawSvgPath.bind(drawer.currentPage)
  drawer.currentPage.drawText = (text, options) => {
    lines.push({ text, x: options?.x ?? 0, y: options?.y ?? 0 })
    return drawText(text, options)
  }
  drawer.currentPage.drawSvgPath = (path, options) => {
    backgrounds.push(options?.y ?? 0)
    return drawBackground(path, options)
  }
  const top = 600
  const fontSize = 11
  const ascent = fontMetrics('Inter', fontSize).ascent
  const descent = fontMetrics('Inter', fontSize).height - ascent
  let initialLines: string[] | undefined
  for (const padding of [
    { x: 0, y: 0 },
    { x: 3, y: 2 },
    { x: 6, y: 4 },
    { x: 12, y: 10 }
  ]) {
    lines.length = 0
    backgrounds.length = 0
    const bottom = drawer.drawBadge(
      'Category with multiple lines of text',
      { color: '#336699', text: 'white' },
      { xStart: 30, yStart: top, fontSize, width: 120 + 2 * padding.x, padding }
    )
    t.true(lines.length > 1)
    t.is(backgrounds[0], top + padding.y)
    t.true(Math.abs(lines[0].y + ascent - top) < 1e-6)
    const content = lines.map(({ text }) => text)
    if (initialLines) t.deepEqual(content, initialLines)
    else initialLines = content
    for (const line of lines) {
      t.is(line.x, 30 + padding.x)
      t.true(line.y + ascent + padding.y <= backgrounds[0] + 1e-6)
      t.true(line.y - descent - padding.y >= bottom - 1e-6)
    }
  }
})

for (const fontName of ['Inter', 'NotoSans'] as const) {
  test(`${fontName}: plain text, multiline text and badges share their text upper edge`, async (t) => {
    const drawer = await createDrawer(fontName)
    const rendered = mock.method(drawer.currentPage, 'drawText')
    t.teardown(() => rendered.mock.restore())
    for (const fontSize of [9, 11, 16]) {
      rendered.mock.resetCalls()
      const options = { xStart: 30, yStart: 700, fontSize }
      const height = fontMetrics(fontName, fontSize).height
      const ascent = fontMetrics(fontName, fontSize).ascent
      const plainBottom = drawer.drawText('Agyp', options)
      const multilineBottom = drawer.drawMultilineText('Agyp\n\nlast', options)
      const badgeBottom = drawer.drawBadge('Agyp', { color: '#336699', text: 'white' }, options)
      const baselines = rendered.mock.calls.map(({ arguments: [, opts] }) => opts?.y ?? 0)
      t.deepEqual(baselines, [700 - ascent, 700 - ascent, 700 - height - ascent, 700 - 2 * height - ascent, 700 - ascent])
      t.is(plainBottom, 700 - height)
      t.is(multilineBottom, 700 - 3 * height)
      t.is(badgeBottom, plainBottom - 2)
      t.true(baselines[3] > multilineBottom)
    }
  })

  test(`${fontName}: flags center on the last place line and on table text`, async (t) => {
    const drawer = await createDrawer(fontName)
    const rendered = mock.method(drawer.currentPage, 'drawText')
    const images = mock.method(drawer.currentPage, 'drawImage')
    t.teardown(() => {
      rendered.mock.restore()
      images.mock.restore()
    })
    const country = { _id: 'DE', name: { de: 'Deutschland', en: '', fr: '', es: '', ru: '', kk: '' } }
    const fontSize = 11
    const height = fontMetrics(fontName, fontSize).height
    const ascent = fontMetrics(fontName, fontSize).ascent
    const bottom = await drawer.drawMultilineTextWithPlace(
      'Destination: ',
      { country, place: 'Berlin' },
      { xStart: 30, yStart: 700, fontSize, width: 100 }
    )
    t.true(rendered.mock.calls.length > 1)
    t.is(images.mock.calls.length, 1)
    const lastText = rendered.mock.calls.at(-1)?.arguments[1]
    const image = images.mock.calls[0].arguments[1]
    if (!lastText || !image) throw new Error('Missing place text or flag')
    const textCenter = (lastText.y ?? 0) + ascent - height / 2
    t.true(Math.abs((image.y ?? 0) + (image.height ?? 0) / 2 - textCenter) < 1e-6)
    t.true(Math.abs(bottom - (textCenter - height / 2)) < 1e-6)

    rendered.mock.resetCalls()
    images.mock.resetCalls()
    const tableBottom = await drawer.drawTable(
      [{ country }],
      [
        {
          key: 'country',
          width: 100,
          title: 'Country',
          alignment: TextAlignment.Left,
          fn: (value: typeof country) => value.name.de,
          countryCodeForFlag: (value: typeof country) => value._id
        }
      ],
      { xStart: 30, yStart: 600, fontSize, firstRow: false }
    )
    const tableText = rendered.mock.calls.at(-1)?.arguments[1]
    const tableFlag = images.mock.calls[0]?.arguments[1]
    if (!tableText || !tableFlag) throw new Error('Missing table text or flag')
    t.true(Math.abs((tableFlag.y ?? 0) + (tableFlag.height ?? 0) / 2 - ((tableText.y ?? 0) + ascent - height / 2)) < 1e-6)
    t.true((tableFlag.y ?? 0) >= tableBottom)
  })

  test(`${fontName}: icon labels center both fonts inside their top-aligned area`, async (t) => {
    const drawer = await createDrawer(fontName)
    const rendered = mock.method(drawer.currentPage, 'drawText')
    t.teardown(() => rendered.mock.restore())
    for (const icons of [[], ['receipt'], ['unknown-icon']]) {
      rendered.mock.resetCalls()
      const top = 700
      const fontSize = 16
      const bottom = drawer.drawIconLabel(icons, 'Agyp', { xStart: 30, yStart: top, fontSize })
      t.is(rendered.mock.calls.length, icons[0] === 'receipt' ? 2 : 1)
      for (const {
        arguments: [, options]
      } of rendered.mock.calls) {
        if (!options?.font) throw new Error('Missing rendered font')
        const { ascent, height } = fontMetrics(options.font === drawer.font ? fontName : 'BootstrapIcons', fontSize)
        const textTop = (options.y ?? 0) + ascent
        t.true(textTop <= top + 1e-6)
        t.true(textTop - height >= bottom - 1e-6)
        t.true(Math.abs(textTop - height / 2 - (top + bottom) / 2) < 1e-6)
      }
    }
  })
}

for (const fontName of ['Inter', 'NotoSans'] as const) {
  test(`${fontName}: badge backgrounds contain actual umlaut and descender outlines with padding`, async (t) => {
    const drawer = await createDrawer(fontName)
    const rendered = mock.method(drawer.currentPage, 'drawText')
    const backgrounds = mock.method(drawer.currentPage, 'drawSvgPath')
    t.teardown(() => {
      rendered.mock.restore()
      backgrounds.mock.restore()
    })
    for (const fontSize of [9, 11, 16]) {
      for (const paddingY of [0, 2, 4]) {
        rendered.mock.resetCalls()
        backgrounds.mock.resetCalls()
        const bottom = drawer.drawBadge(
          'ÄÖÜ Élève gy Büro',
          { color: '#336699', text: 'white' },
          { xStart: 30, yStart: 700, fontSize, width: 130, padding: { x: 3, y: paddingY } }
        )
        const backgroundTop = backgrounds.mock.calls[0].arguments[1]?.y ?? 0
        for (const {
          arguments: [text, options]
        } of rendered.mock.calls) {
          const bounds = testFonts[fontName].layout(text).bbox
          const scale = fontSize / testFonts[fontName].unitsPerEm
          const baseline = options?.y ?? 0
          t.true(backgroundTop - (baseline + bounds.maxY * scale) >= paddingY - 1e-6)
          t.true(baseline + bounds.minY * scale - bottom >= paddingY - 1e-6)
        }
      }
    }
  })

  test(`${fontName}: compact table rows leave room above umlauts and keep the baseline inset`, async (t) => {
    const drawer = await createDrawer(fontName)
    const rendered = mock.method(drawer.currentPage, 'drawText')
    t.teardown(() => rendered.mock.restore())
    for (const fontSize of [9, 11]) {
      rendered.mock.resetCalls()
      const top = 700
      const text = 'ÄÖÜ Agyp'
      const bottom = await drawer.drawTable([{ text }], [{ key: 'text', width: 200, title: 'Text', alignment: TextAlignment.Left }], {
        xStart: 30,
        yStart: top,
        fontSize,
        firstRow: false
      })
      const baseline = rendered.mock.calls[0].arguments[1]?.y ?? 0
      const glyphTop = baseline + (testFonts[fontName].layout(text).bbox.maxY * fontSize) / testFonts[fontName].unitsPerEm
      t.true(top - glyphTop >= 2)
      t.true(top - bottom < fontMetrics(fontName, fontSize).height + 2 * printerSettings.cellPadding.bottom)
      t.true(Math.abs(baseline - bottom - printerSettings.cellPadding.bottom) < 1e-6)
    }
  })
}

test('tables use their upper edge, contain multiline text and return their lower border', async (t) => {
  const drawer = await createDrawer()
  const rendered = mock.method(drawer.currentPage, 'drawText')
  const borders = mock.method(drawer.currentPage, 'drawLine')
  t.teardown(() => {
    rendered.mock.restore()
    borders.mock.restore()
  })
  const fontSize = 11
  const height = fontMetrics('Inter', fontSize).height
  const ascent = fontMetrics('Inter', fontSize).ascent
  const columns: Column<{ text: string }>[] = [{ key: 'text', width: 150, title: 'Text', alignment: TextAlignment.Left }]
  const bottom = await drawer.drawTable([{ text: 'Agyp\nlast' }, { text: 'next' }], columns, {
    xStart: 30,
    yStart: 700,
    fontSize,
    firstRow: false
  })
  const baselines = rendered.mock.calls.map(({ arguments: [, options] }) => options?.y ?? 0)
  const paddingTop = fontSize / 4
  const rowHeight = ascent + paddingTop + printerSettings.cellPadding.bottom
  const firstRowBottom = 700 - height - rowHeight
  t.deepEqual(baselines, [700 - paddingTop - ascent, 700 - paddingTop - height - ascent, firstRowBottom - paddingTop - ascent])
  t.true(firstRowBottom < baselines[1])
  t.is(bottom, firstRowBottom - Math.max(fontSize * 1.5, rowHeight))
  const horizontalBorders = borders.mock.calls
    .map(({ arguments: [options] }) => options)
    .filter((options) => options.start.y === options.end.y)
  t.deepEqual(
    horizontalBorders.map((options) => options.start.y),
    [700, firstRowBottom, bottom]
  )
  t.is(await drawer.drawTable([], columns, { xStart: 30, yStart: bottom, fontSize }), bottom)
})

test('tables move whole rows including descenders and padding to the next page', async (t) => {
  const drawer = await createDrawer()
  const originalPage = drawer.currentPage
  const originalText = mock.method(originalPage, 'drawText')
  t.teardown(() => originalText.mock.restore())
  const fontSize = 11
  const { ascent } = fontMetrics('Inter', fontSize)
  const rowHeight = ascent + fontSize / 4 + printerSettings.cellPadding.bottom
  const columns: Column<{ text: string }>[] = [{ key: 'text', width: 100, title: 'Text', alignment: TextAlignment.Left }]
  const bottom = await drawer.drawTable([{ text: 'Agyp' }], columns, {
    xStart: 30,
    yStart: printerSettings.pagePadding + rowHeight - 1,
    fontSize,
    firstRow: false
  })
  t.is(originalText.mock.calls.length, 0)
  t.is(drawer.doc.getPageCount(), 2)
  t.is(bottom, drawer.currentPage.getHeight() - printerSettings.pagePadding - rowHeight)
  t.is(drawer.currentPage, drawer.doc.getPage(1))

  const tallRow = Array.from({ length: 100 }, () => 'Agyp').join('\n')
  await drawer.drawTable([{ text: tallRow }], columns, {
    xStart: 30,
    yStart: drawer.currentPage.getHeight() - printerSettings.pagePadding,
    fontSize,
    firstRow: false
  })
  t.is(drawer.doc.getPageCount(), 2)
})

test('organisation logos and their links use the upper edge of the available area', async (t) => {
  const bytes = Buffer.from(PNG_1X1_BASE64, 'base64')
  const drawer = await PDFDrawer.create<string>(
    { ...printerSettings, _id: 'settings' },
    async () => ({ buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), type: 'image/png' }),
    async () => ({ logoId: 'logo', website: 'https://example.org' }),
    new Formatter('de', 'givenNameFirst'),
    'de',
    'portrait'
  )
  const images = mock.method(drawer.currentPage, 'drawImage')
  t.teardown(() => images.mock.restore())
  await drawer.drawOrganisationLogo('organisation', { xStart: 100, yStart: 700, maxWidth: 150, maxHeight: 50 })
  const image = images.mock.calls[0].arguments[1]
  t.is(image?.x, 249)
  t.is(image?.y, 699)
  const annotations = drawer.currentPage.node.Annots()
  const link = drawer.doc.context.lookup(annotations?.get(0), PDFDict)
  t.deepEqual(link.lookup(PDFName.of('Rect'), PDFArray).asArray().map(String), ['249', '699', '250', '700'])
})
