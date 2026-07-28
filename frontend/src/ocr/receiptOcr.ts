import { PaddleOCR } from '@paddleocr/paddleocr-js'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import detectionModelUrl from '../../node_modules/.cache/abrechnung-ocr/PP-OCRv6_small_det_onnx_infer.tar?url'
import recognitionModelUrl from '../../node_modules/.cache/abrechnung-ocr/PP-OCRv6_small_rec_onnx_infer.tar?url'
import ortWasmLoaderUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url'
import ortWasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url'
import pdfWorkerUrl from '../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MAX_PDF_RENDER_SIDE = 2_400
let ocrPromise: ReturnType<typeof PaddleOCR.create> | undefined

function createOcr() {
  return PaddleOCR.create({
    lang: 'de',
    ocrVersion: 'PP-OCRv6',
    textDetectionModelName: 'PP-OCRv6_small_det',
    textDetectionModelAsset: { url: detectionModelUrl },
    textRecognitionModelName: 'PP-OCRv6_small_rec',
    textRecognitionModelAsset: { url: recognitionModelUrl },
    worker: true,
    ortOptions: {
      backend: 'wasm',
      numThreads: 1,
      simd: true,
      // PaddleOCR's public type currently only exposes the string form, while
      // ONNX Runtime also accepts explicit local loader/WASM URL pairs.
      wasmPaths: { mjs: ortWasmLoaderUrl, wasm: ortWasmUrl } as unknown as string
    }
  })
}

function getOcr() {
  ocrPromise ??= createOcr()
  return ocrPromise
}

async function predictText(image: Blob | HTMLCanvasElement) {
  const [result] = await (await getOcr()).predict(image)
  return (
    result?.items
      .map(({ text }) => text.trim())
      .filter(Boolean)
      .join('\n') ?? ''
  )
}

async function textFromPdf(file: Blob) {
  const loadingTask = getDocument({ data: await file.arrayBuffer() })
  const pdf = await loadingTask.promise
  try {
    const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, index) => pdf.getPage(index + 1)))
    const pageTexts = await Promise.all(
      pages.map(async (page) => {
        const content = await page.getTextContent()
        return content.items.flatMap((item) => ('str' in item && item.str.trim() ? [item.str.trim()] : [])).join(' ')
      })
    )
    const embeddedText = pageTexts.filter(Boolean).join('\n\n').trim()
    if (embeddedText) return embeddedText

    const recognizedPages: string[] = []
    for (const page of pages) {
      const initialViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(2, MAX_PDF_RENDER_SIDE / Math.max(initialViewport.width, initialViewport.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Unable to create a PDF rendering context')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvas, canvasContext: context, viewport }).promise
      recognizedPages.push(await predictText(canvas))
      canvas.width = 0
      canvas.height = 0
      page.cleanup()
    }
    return recognizedPages.filter(Boolean).join('\n\n')
  } finally {
    await loadingTask.destroy()
  }
}

export async function extractReceiptText(file: Blob) {
  return file.type === 'application/pdf' ? await textFromPdf(file) : await predictText(file)
}

export async function warmReceiptOcr() {
  await getOcr()
}

export async function disposeReceiptOcr() {
  const current = ocrPromise
  ocrPromise = undefined
  if (current) await (await current).dispose()
}
