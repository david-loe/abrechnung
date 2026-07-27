import { readFile } from 'node:fs/promises'
import bootstrapIconCodepoints from 'bootstrap-icons/font/bootstrap-icons.json' with { type: 'json' }
import { PDFDocument } from 'pdf-lib'

const bootstrapIconFont = readFile(new URL(import.meta.resolve('bootstrap-icons/font/fonts/bootstrap-icons.woff')))
const codepoints: Record<string, number> = bootstrapIconCodepoints

export function getBootstrapIconGlyph(iconName: string) {
  const codepoint = codepoints[iconName]
  return codepoint === undefined ? undefined : String.fromCodePoint(codepoint)
}

export async function embedBootstrapIconFont(document: PDFDocument) {
  return await document.embedFont(await bootstrapIconFont, { subset: true })
}
