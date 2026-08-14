import { Types } from 'mongoose'
import { ValidationClientError } from './controller/error.js'
import DocumentFile from './models/documentFile.js'

export const TEMPORARY_DOCUMENT_FILE_TTL_MS = 24 * 60 * 60 * 1_000
export const MAX_OCR_CHARACTERS = 500_000

export function temporaryDocumentFileExpiration() {
  return new Date(Date.now() + TEMPORARY_DOCUMENT_FILE_TTL_MS)
}

export function referencedDocumentFileIds(receipts: unknown) {
  if (!Array.isArray(receipts)) return []
  return receipts.map((receipt) => {
    if (typeof receipt === 'string') return receipt
    if (receipt && typeof receipt === 'object' && '_id' in receipt && typeof receipt._id === 'string') return receipt._id
    throw new ValidationClientError('Invalid document file reference.', [{ path: 'receipts', message: 'invalid' }])
  })
}

function uniqueIds(documentFileIds: string[]) {
  const ids = [...new Set(documentFileIds)]
  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    throw new ValidationClientError('Invalid document file reference.', [{ path: 'documentFileIds', message: 'invalid' }])
  }
  return ids
}

export async function validateDocumentFileReferences(documentFileIds: string[], owner: string | Types.ObjectId) {
  const ids = uniqueIds(documentFileIds)
  if (ids.length === 0) return ids

  const count = await DocumentFile.countDocuments({ _id: { $in: ids }, owner })
  if (count !== ids.length) {
    throw new ValidationClientError('Invalid document file reference.', [{ path: 'receipts', message: 'notAllowed' }])
  }
  return ids
}

export async function claimDocumentFiles(documentFileIds: string[], owner?: string | Types.ObjectId) {
  const ids = owner ? await validateDocumentFileReferences(documentFileIds, owner) : uniqueIds(documentFileIds)
  if (ids.length > 0) {
    const filter = { _id: { $in: ids }, ...(owner ? { owner } : {}) }
    const result = await DocumentFile.updateMany(filter, { $unset: { expiresAt: 1 } })
    if (result.matchedCount !== ids.length) {
      throw new ValidationClientError('Invalid document file reference.', [{ path: 'documentFileIds', message: 'notAllowed' }])
    }
  }
}
