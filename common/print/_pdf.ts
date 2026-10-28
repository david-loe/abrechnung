import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFOperatorList, TextItem } from 'pdfjs-dist/types/src/display/api.js'

/** Read the saved document with a different PDF implementation than the writer. */
export async function readPdf(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 })
  try {
    const document = await task.promise
    const pages = []
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index)
      const content = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1 })
      const text = content.items.filter((item): item is TextItem => 'str' in item)
      const operators = await page.getOperatorList()
      pages.push({
        text,
        content: text.map(({ str }) => str).join(' '),
        width: viewport.width,
        height: viewport.height,
        annotations: await page.getAnnotations(),
        operators,
        images: imageRectangles(operators)
      })
    }
    return pages
  } finally {
    await task.destroy()
  }
}

// Image placement is read from saved PDF graphics operators, not drawing callbacks.
function imageRectangles(operators: PDFOperatorList) {
  const stack: number[][] = []
  let matrix = [1, 0, 0, 1, 0, 0]
  const images: number[][] = []
  for (let index = 0; index < operators.fnArray.length; index++) {
    const operation = operators.fnArray[index]
    if (operation === OPS.save) stack.push([...matrix])
    if (operation === OPS.restore) {
      const previous = stack.pop()
      if (!previous) throw new Error('Unbalanced PDF graphics state')
      matrix = previous
    }
    if (operation === OPS.transform) {
      const [a, b, c, d, e, f] = operators.argsArray[index] as number[]
      const [ma, mb, mc, md, me, mf] = matrix
      matrix = [ma * a + mc * b, mb * a + md * b, ma * c + mc * d, mb * c + md * d, ma * e + mc * f + me, mb * e + md * f + mf]
    }
    if (operation === OPS.paintImageXObject) {
      const corners = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1]
      ].map(([x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]])
      images.push([
        Math.min(...corners.map(([x]) => x)),
        Math.min(...corners.map(([, y]) => y)),
        Math.max(...corners.map(([x]) => x)),
        Math.max(...corners.map(([, y]) => y))
      ])
    }
  }
  return images
}
