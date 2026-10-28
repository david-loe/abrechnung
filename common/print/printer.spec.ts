import { readFileSync } from 'node:fs'
import test from 'ava'
import fontkit from 'pdf-fontkit'
import { decodeFromBase64DataUri, TextAlignment } from 'pdf-lib'
import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import fontsBASE64 from '../fonts/base64.json' with { type: 'json' }
import Formatter from '../utils/formatter.js'
import { readPdf } from './_pdf.js'
import { type Column, PDFDrawer } from './printer.js'
import printerSettings from './printerSettings.js'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8LrH8AAAAASUVORK5CYII=', 'base64')
const fonts = {
  Inter: fontkit.create(decodeFromBase64DataUri(fontsBASE64.Inter)),
  NotoSans: fontkit.create(decodeFromBase64DataUri(fontsBASE64.NotoSans)),
  BootstrapIcons: fontkit.create(readFileSync(new URL(import.meta.resolve('bootstrap-icons/font/fonts/bootstrap-icons.woff'))))
}

function createDrawer(fontName: 'Inter' | 'NotoSans' = 'Inter') {
  return PDFDrawer.create(
    { ...printerSettings, fontName, _id: 'settings' },
    async () => null,
    async () => null,
    new Formatter('de', 'givenNameFirst'),
    'de',
    'portrait'
  )
}

function widthOf(text: string, fontName: 'Inter' | 'NotoSans', size: number) {
  const font = fonts[fontName]
  return (
    (font.layout(text).glyphs.reduce((sum: number, glyph: { advanceWidth: number }) => sum + glyph.advanceWidth, 0) * size) /
    font.unitsPerEm
  )
}

function bounds(text: string, baseline: number, fontName: keyof typeof fonts, size: number) {
  const font = fonts[fontName]
  const box = font.layout(text).bbox
  return { top: baseline + (box.maxY * size) / font.unitsPerEm, bottom: baseline + (box.minY * size) / font.unitsPerEm }
}

test('given two receipts, table links in the saved PDF lead to their separate attachment pages', async (t) => {
  const drawer = await createDrawer()
  await drawer.drawTable(
    [{ receipts: ['r1', 'r2'] }],
    [
      {
        key: 'receipts',
        width: 100,
        alignment: TextAlignment.Left,
        title: 'Belege',
        fn: () => '1, 2',
        internalPdfLinkSegments: () => [
          { text: '1', targetId: 'r1' },
          { text: '2', targetId: 'r2' }
        ]
      }
    ],
    { xStart: 30, yStart: 700, fontSize: 9 }
  )
  await drawer.attachReceipts(
    Object.fromEntries(
      ['r1', 'r2'].map((id, index) => [
        id,
        { _id: id, number: index + 1, date: new Date('2026-01-01'), type: 'image/png', data: new Blob([PNG]) }
      ])
    )
  )
  const pages = await readPdf(await drawer.finish())
  t.is(pages.length, 3)
  t.is(pages[0].annotations.length, 2)
  const destinations = pages[0].annotations.map(({ dest }) => JSON.stringify(dest))
  t.is(new Set(destinations).size, 2)
  for (const annotation of pages[0].annotations) {
    t.is(annotation.subtype, 'Link')
    t.truthy(annotation.dest)
    const [left, bottom, right, top] = annotation.rect
    t.true(right > left && top > bottom)
    const receiptText = pages[0].text.find(({ str }) => str.includes('1, 2'))
    t.truthy(receiptText)
    if (!receiptText) throw new Error('Missing receipt text in the PDF')
    t.true(receiptText.transform[5] >= bottom - 1 && receiptText.transform[5] <= top)
  }
})

test('given two external links, both URLs and clickable rectangles survive saving', async (t) => {
  const drawer = await createDrawer()
  drawer.drawLink('https://example.org/a', { xStart: 10, yStart: 30, width: 20, height: 20 })
  drawer.drawLink('https://example.org/b', { xStart: 40, yStart: 60, width: 20, height: 20 })
  const [page] = await readPdf(await drawer.finish())
  t.deepEqual(
    page.annotations.map(({ url, rect }) => ({ url, rect })),
    [
      { url: 'https://example.org/a', rect: [10, 10, 30, 30] },
      { url: 'https://example.org/b', rect: [40, 40, 60, 60] }
    ]
  )
})

for (const fontName of ['Inter', 'NotoSans'] as const) {
  test(`${fontName}: long words and exact fits remain complete and inside the requested text width`, async (t) => {
    for (const input of ['Fits exactly', `Words before ${'Ü'.repeat(80)} and after`]) {
      const drawer = await createDrawer(fontName)
      const width = input === 'Fits exactly' ? widthOf(input, fontName, 11) : 140
      drawer.drawMultilineText(input, { xStart: 30, yStart: 700, fontSize: 11, width })
      drawer.drawBadge(
        input,
        { color: '#336699', text: 'white' },
        { xStart: 30, yStart: 500, fontSize: 11, width: width + 6, padding: { x: 3, y: 2 } }
      )
      const [page] = await readPdf(await drawer.finish())
      const plain = page.text.filter(({ str, transform }) => str.trim() && transform[5] > 500)
      const badge = page.text.filter(({ str, transform }) => str.trim() && transform[5] <= 500)
      t.is(
        plain
          .map(({ str }) => str)
          .join('')
          .replace(/\s/gu, ''),
        input.replace(/\s/gu, '')
      )
      t.is(
        badge
          .map(({ str }) => str)
          .join('')
          .replace(/\s/gu, ''),
        input.replace(/\s/gu, '')
      )
      for (const item of [...plain, ...badge]) {
        t.true(item.transform[4] >= 30)
        t.true(item.transform[4] + item.width <= 33 + width + 0.1)
      }
      if (input === 'Fits exactly') t.is(plain.length, 1)
      else t.true(plain.length > 2)
    }
  })

  test(`${fontName}: blank lines preserve vertical spacing and very narrow text makes progress`, async (t) => {
    const drawer = await createDrawer(fontName)
    const bottom = drawer.drawMultilineText(' first line\n\nlast line ', { xStart: 30, yStart: 700, fontSize: 11, width: 300 })
    drawer.drawMultilineText('ABC', { xStart: 30, yStart: 500, fontSize: 11, width: 1 })
    const [page] = await readPdf(await drawer.finish())
    const first = page.text.find(({ str }) => str.trim() === 'first line')
    const last = page.text.find(({ str }) => str.trim() === 'last line')
    if (!first || !last) throw new Error('Missing multiline text')
    const height = ((fonts[fontName].ascent - fonts[fontName].descent) * 11) / fonts[fontName].unitsPerEm
    t.true(Math.abs(first.transform[5] - last.transform[5] - 2 * height) < 0.01)
    t.true(last.transform[5] > bottom)
    t.deepEqual(
      page.text.filter(({ str }) => /^[ABC]$/.test(str)).map(({ str }) => str),
      ['A', 'B', 'C']
    )
  })

  for (const [input, lines] of [
    ['ABC   ', 1],
    ['ABC   \n', 2],
    ['ABC   \n\nABC', 3]
  ] as const) {
    test(`${fontName}: trailing spaces consume no extra wrapped line (${JSON.stringify(input)})`, async (t) => {
      const drawer = await createDrawer(fontName)
      const height = ((fonts[fontName].ascent - fonts[fontName].descent) * 11) / fonts[fontName].unitsPerEm
      const bottom = drawer.drawMultilineText(input, { xStart: 30, yStart: 700, fontSize: 11, width: widthOf('ABC', fontName, 11) })
      t.true(Math.abs(bottom - (700 - lines * height)) < 0.01)
      const [page] = await readPdf(await drawer.finish())
      t.is(page.text.filter(({ str }) => str === 'ABC').length, input.includes('\n\n') ? 2 : 1)
    })
  }

  test(`${fontName}: badges contain umlauts and descenders and retain their alignment for different padding`, async (t) => {
    for (const size of [9, 11, 16]) {
      for (const paddingY of [0, 2, 4]) {
        const drawer = await createDrawer(fontName)
        const bottom = drawer.drawBadge(
          'ÄÖÜ Élève gy Büro',
          { color: '#336699', text: 'white' },
          { xStart: 30, yStart: 700, fontSize: size, width: 130, padding: { x: 3, y: paddingY } }
        )
        const [page] = await readPdf(await drawer.finish())
        t.is(page.content.replace(/\s/gu, ''), 'ÄÖÜÉlèvegyBüro')
        t.true(page.operators.fnArray.includes(OPS.constructPath))
        for (const item of page.text.filter(({ str }) => str.trim())) {
          const box = bounds(item.str, item.transform[5], fontName, size)
          t.true(box.top <= 700 + 0.01)
          t.true(box.bottom >= bottom + paddingY - 0.01)
          t.true(item.transform[4] >= 33)
          t.true(item.transform[4] + item.width <= 157.1)
        }
      }
    }
  })

  test(`${fontName}: plain text, multiline text and badges align in the final document`, async (t) => {
    for (const size of [9, 11, 16]) {
      const drawer = await createDrawer(fontName)
      drawer.drawText('Agyp', { xStart: 30, yStart: 700, fontSize: size })
      drawer.drawMultilineText('Agyp\n\nlast', { xStart: 150, yStart: 700, fontSize: size, width: 100 })
      drawer.drawBadge('Agyp', { color: '#336699', text: 'white' }, { xStart: 300, yStart: 700, fontSize: size })
      const [page] = await readPdf(await drawer.finish())
      const baselines = page.text.filter(({ str }) => str === 'Agyp').map(({ transform }) => transform[5])
      t.is(baselines.length, 3)
      t.true(baselines.every((y) => Math.abs(y - baselines[0]) < 0.01))
    }
  })

  test(`${fontName}: places and tables retain their flags and legible text`, async (t) => {
    const drawer = await createDrawer(fontName)
    const country = { _id: 'DE', name: { de: 'Deutschland', en: '', fr: '', es: '', ru: '', kk: '' } }
    await drawer.drawMultilineTextWithPlace(
      'Destination: ',
      { country, place: 'Berlin' },
      { xStart: 30, yStart: 700, fontSize: 11, width: 100 }
    )
    await drawer.drawTable(
      [{ country }],
      [
        {
          key: 'country',
          width: 100,
          title: 'Country',
          alignment: TextAlignment.Left,
          fn: () => 'Deutschland',
          countryCodeForFlag: () => 'DE'
        }
      ],
      { xStart: 30, yStart: 600, fontSize: 11, firstRow: false }
    )
    const [page] = await readPdf(await drawer.finish())
    t.true(page.content.includes('Berlin'))
    t.true(page.content.includes('Deutschland'))
    t.is(page.images.length, 2)
    const texts = [
      page.text.filter(({ str, transform }) => str.trim() && transform[5] > 600).at(-1),
      page.text.find(({ str, transform }) => str.includes('Deutschland') && transform[5] < 600)
    ]
    for (const [index, item] of texts.entries()) {
      if (!item) throw new Error('Missing place text')
      const font = fonts[fontName]
      const textCenter = item.transform[5] + ((font.ascent + font.descent) * 11) / (2 * font.unitsPerEm)
      const imageCenter = (page.images[index][1] + page.images[index][3]) / 2
      t.true(
        Math.abs(textCenter - imageCenter) < 0.01,
        JSON.stringify({ text: item.str, textCenter, imageCenter, image: page.images[index] })
      )
    }
  })

  test(`${fontName}: known icons render alongside their label while unknown icons are ignored`, async (t) => {
    const counts = []
    for (const icons of [[], ['receipt'], ['unknown-icon']]) {
      const drawer = await createDrawer(fontName)
      const bottom = drawer.drawIconLabel(icons, 'Agyp', { xStart: 30, yStart: 700, fontSize: 16 })
      const [page] = await readPdf(await drawer.finish())
      const items = page.text.filter(({ str }) => str.trim())
      t.true(items.some(({ str }) => str === 'Agyp'))
      t.true(items.every(({ transform }) => transform[5] <= 700 && transform[5] >= bottom))
      counts.push(items.length)
    }
    t.deepEqual(counts, [1, 2, 1])
  })
}

test('given a multiline table, text remains inside its rows and the lower border is returned', async (t) => {
  const drawer = await createDrawer()
  const columns: Column<{ text: string }>[] = [{ key: 'text', width: 150, title: 'Text', alignment: TextAlignment.Left }]
  const bottom = await drawer.drawTable([{ text: 'Agyp\nlast' }, { text: 'next' }], columns, {
    xStart: 30,
    yStart: 700,
    fontSize: 11,
    firstRow: false
  })
  t.is(await drawer.drawTable([], columns, { xStart: 30, yStart: bottom, fontSize: 11 }), bottom)
  const [page] = await readPdf(await drawer.finish())
  t.deepEqual(
    page.text.filter(({ str }) => str.trim()).map(({ str }) => str),
    ['Agyp', 'last', 'next']
  )
  for (const item of page.text.filter(({ str }) => str.trim())) {
    t.true(item.transform[5] < 700 && item.transform[5] > bottom)
  }
})

test('given insufficient page space, the whole table row appears on the next page', async (t) => {
  const drawer = await createDrawer()
  const bottom = await drawer.drawTable(
    [{ text: 'ÄÖÜ Agyp' }],
    [{ key: 'text', width: 100, title: 'Text', alignment: TextAlignment.Left }],
    { xStart: 30, yStart: printerSettings.pagePadding + 2, fontSize: 11, firstRow: false }
  )
  const pages = await readPdf(await drawer.finish())
  t.is(pages.length, 2)
  t.is(pages[0].content.trim(), '')
  t.true(pages[1].content.includes('ÄÖÜ Agyp'))
  t.true(pages[1].text[0].transform[5] > bottom)
})

test('given an organisation logo, its saved link covers the rendered image area', async (t) => {
  const drawer = await PDFDrawer.create<string>(
    { ...printerSettings, _id: 'settings' },
    async () => ({ buffer: PNG.buffer.slice(PNG.byteOffset, PNG.byteOffset + PNG.byteLength), type: 'image/png' }),
    async () => ({ logoId: 'logo', website: 'https://example.org' }),
    new Formatter('de', 'givenNameFirst'),
    'de',
    'portrait'
  )
  await drawer.drawOrganisationLogo('organisation', { xStart: 100, yStart: 700, maxWidth: 150, maxHeight: 50 })
  const [page] = await readPdf(await drawer.finish())
  t.deepEqual(
    page.annotations.map(({ url, rect }) => ({ url, rect })),
    [{ url: 'https://example.org/', rect: [249, 699, 250, 700] }]
  )
  t.deepEqual(page.images, [[249, 699, 250, 700]])
})
