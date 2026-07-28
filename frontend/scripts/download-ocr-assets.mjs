import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { EnvHttpProxyAgent, fetch, setGlobalDispatcher } from 'undici'

setGlobalDispatcher(new EnvHttpProxyAgent())

const outputDirectory = new URL('../node_modules/.cache/abrechnung-ocr/', import.meta.url)
const assets = [
  {
    name: 'PP-OCRv6_small_det_onnx_infer.tar',
    sha256: 'd218f6fbf0f1c23d2161bd6ac7f5eaa6104fa89955c09290497e31008e2618e4',
    url: 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_onnx_infer.tar'
  },
  {
    name: 'PP-OCRv6_small_rec_onnx_infer.tar',
    sha256: 'd267ab077a44a0eedb1ea8f8c542d263f211de8e9d7a029bf9fcfff7e5a88fb1',
    url: 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_rec_onnx_infer.tar'
  }
]

function hash(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

async function hasExpectedHash(file, sha256) {
  try {
    return hash(await readFile(file)) === sha256
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

async function download(url) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000))
    }
  }
  throw lastError
}

await mkdir(outputDirectory, { recursive: true })

for (const asset of assets) {
  const destination = new URL(asset.name, outputDirectory)
  if (await hasExpectedHash(destination, asset.sha256)) continue

  const contents = await download(asset.url).catch((error) => {
    throw new Error(`Unable to download ${asset.name}`, { cause: error })
  })
  const actualHash = hash(contents)
  if (actualHash !== asset.sha256) {
    throw new Error(`Invalid SHA-256 for ${asset.name}: expected ${asset.sha256}, received ${actualHash}`)
  }

  const temporary = new URL(`${asset.name}.tmp`, outputDirectory)
  await writeFile(temporary, contents)
  await unlink(destination).catch((error) => {
    if (error?.code !== 'ENOENT') throw error
  })
  await rename(temporary, destination)
  console.log(`Prepared ${asset.name}`)
}
