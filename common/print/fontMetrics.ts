import fontkit from 'pdf-fontkit'
import { decodeFromBase64DataUri, PDFDocument, PDFFont } from 'pdf-lib'

interface FontMetrics {
  ascent: number
  descent: number
}

const sourceMetrics = new Map<string | Uint8Array, FontMetrics>()
const embeddedMetrics = new WeakMap<PDFFont, FontMetrics>()

export async function embedFontWithMetrics(document: PDFDocument, data: string | Uint8Array) {
  let metrics = sourceMetrics.get(data)
  if (!metrics) {
    const font = fontkit.create(typeof data === 'string' ? decodeFromBase64DataUri(data) : data)
    // Scale both ascender and descender from font units. pdf-lib's descender:false
    // calculation subtracts an unscaled descender and gives incorrect results for Inter.
    metrics = { ascent: font.ascent / font.unitsPerEm, descent: -font.descent / font.unitsPerEm }
    sourceMetrics.set(data, metrics)
  }
  const font = await document.embedFont(data, { subset: true })
  embeddedMetrics.set(font, metrics)
  return font
}

export function getTextMetrics(font: PDFFont, fontSize: number) {
  const metrics = embeddedMetrics.get(font)
  if (!metrics) throw new Error('Font must be embedded with its metrics')
  const ascent = metrics.ascent * fontSize
  const descent = metrics.descent * fontSize
  return { ascent, descent, height: ascent + descent }
}
