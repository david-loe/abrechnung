import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const assetDirectory = new URL('../src/ocr/assets/', import.meta.url)
const assets = [
  { name: 'PP-OCRv6_small_det_onnx_infer.tar', sha256: 'd218f6fbf0f1c23d2161bd6ac7f5eaa6104fa89955c09290497e31008e2618e4' },
  { name: 'PP-OCRv6_small_rec_onnx_infer.tar', sha256: 'd267ab077a44a0eedb1ea8f8c542d263f211de8e9d7a029bf9fcfff7e5a88fb1' }
]

for (const asset of assets) {
  const contents = await readFile(new URL(asset.name, assetDirectory)).catch((error) => {
    throw new Error(`Bundled OCR asset is missing: ${asset.name}`, { cause: error })
  })
  const actualHash = createHash('sha256').update(contents).digest('hex')
  if (actualHash !== asset.sha256) {
    throw new Error(`Invalid SHA-256 for ${asset.name}: expected ${asset.sha256}, received ${actualHash}`)
  }
}

console.log('Bundled OCR assets verified')
