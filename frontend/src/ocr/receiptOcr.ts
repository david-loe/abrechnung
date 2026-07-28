import { PaddleOCR } from '@paddleocr/paddleocr-js'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import ortWasmLoaderUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url'
import ortWasmUrl from '../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url'
import pdfWorkerUrl from '../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url'
import detectionModelUrl from './assets/PP-OCRv6_small_det_onnx_infer.tar?url'
import recognitionModelUrl from './assets/PP-OCRv6_small_rec_onnx_infer.tar?url'
import { textFromPdfPages } from './pdfText.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

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
    return await textFromPdfPages(pages, predictText)
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
