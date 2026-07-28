import request from 'supertest'

interface PendingDocumentFile {
  name: string
  type: string
  data: string
}

function isPendingDocumentFile(file: unknown): file is PendingDocumentFile {
  if (!file || typeof file !== 'object') return false
  const value = file as Partial<PendingDocumentFile>
  return typeof value.name === 'string' && typeof value.type === 'string' && typeof value.data === 'string'
}

export async function uploadPendingReceipts(agent: request.Agent, value: unknown, options: { endpoint?: string; ownerId?: string } = {}) {
  const document = value as { cost?: { receipts?: unknown[] } }
  if (!document.cost?.receipts) return

  document.cost.receipts = await Promise.all(
    document.cost.receipts.map(async (receipt) => {
      if (!isPendingDocumentFile(receipt)) return receipt
      let upload = agent.post(options.endpoint ?? '/documentFile')
      if (options.ownerId) upload = upload.query({ ownerId: options.ownerId })
      const response = await upload.attach('file', receipt.data, { filename: receipt.name, contentType: receipt.type })
      if (response.status !== 201) {
        throw new Error(`Unable to upload test receipt: ${JSON.stringify(response.body)}`)
      }
      return response.body.result
    })
  )
}
