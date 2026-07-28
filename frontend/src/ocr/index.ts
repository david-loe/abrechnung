let modulePromise: Promise<typeof import('./receiptOcr.js')> | undefined
let recognitionQueue = Promise.resolve('')

function loadReceiptOcr() {
  modulePromise ??= import('./receiptOcr.js')
  return modulePromise
}

export async function extractReceiptText(file: Blob) {
  const recognition = recognitionQueue.then(async () => await (await loadReceiptOcr()).extractReceiptText(file))
  recognitionQueue = recognition.catch(() => '')
  return await recognition
}

export async function warmReceiptOcr() {
  await (await loadReceiptOcr()).warmReceiptOcr()
}

export async function disposeReceiptOcr() {
  const current = modulePromise
  modulePromise = undefined
  if (current) await (await current).disposeReceiptOcr()
}
