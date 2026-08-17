let modulePromise: Promise<typeof import('./receiptOcr.js')> | undefined
let recognitionQueue = Promise.resolve('')

function loadReceiptOcr() {
  if (!modulePromise) {
    const current = import('./receiptOcr.js')
    modulePromise = current
    void current.catch(() => {
      if (modulePromise === current) modulePromise = undefined
    })
  }
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
  if (!current) return
  const receiptOcr = await current.catch(() => undefined)
  await receiptOcr?.disposeReceiptOcr()
}
