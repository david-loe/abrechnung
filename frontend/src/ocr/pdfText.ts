import type { PDFPageProxy } from 'pdfjs-dist'

const MAX_PDF_RENDER_SIDE = 2_400

function embeddedPageText(items: unknown[]) {
  return items
    .flatMap((item) =>
      typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string' && item.str.trim() ? [item.str.trim()] : []
    )
    .join(' ')
}

export async function textFromPdfPages(
  pages: PDFPageProxy[],
  predictText: (image: HTMLCanvasElement) => Promise<string>,
  createCanvas = () => document.createElement('canvas')
) {
  const pageTexts: string[] = []
  for (const page of pages) {
    try {
      const content = await page.getTextContent()
      const embeddedText = embeddedPageText(content.items)
      if (embeddedText) {
        pageTexts.push(embeddedText)
        continue
      }

      const initialViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(2, MAX_PDF_RENDER_SIDE / Math.max(initialViewport.width, initialViewport.height))
      const viewport = page.getViewport({ scale })
      const canvas = createCanvas()
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Unable to create a PDF rendering context')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      try {
        await page.render({ canvas, canvasContext: context, viewport }).promise
        pageTexts.push(await predictText(canvas))
      } finally {
        canvas.width = 0
        canvas.height = 0
      }
    } finally {
      page.cleanup()
    }
  }
  return pageTexts.filter(Boolean).join('\n\n')
}
