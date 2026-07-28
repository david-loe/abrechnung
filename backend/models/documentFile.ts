import { DocumentFile, documentFileTypes } from 'abrechnung-common/types.js'
import { detectImageType } from 'abrechnung-common/utils/file.js'
import { model, mongo, Schema, Types } from 'mongoose'

export type StoredDocumentFile = DocumentFile<Types.ObjectId, mongo.Binary> & { ocr?: string | null; expiresAt?: Date | null }

const fileSchema = () =>
  new Schema<StoredDocumentFile>({
    data: { type: Buffer, required: true },
    type: { type: String, enum: documentFileTypes, required: true },
    name: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ocr: { type: String, maxlength: 500_000, select: false },
    expiresAt: { type: Date, default: null, select: false }
  })

const schema = fileSchema()

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

schema.pre('save', function () {
  if (this.isNew && this.type.startsWith('image/') && this.data) {
    // Wrong type in mongodb BSON Binary, so need assertion here
    const detectedType = detectImageType(this.data.buffer as unknown as ArrayBuffer)
    if (detectedType) {
      this.type = detectedType
    }
  }
})

export default model<StoredDocumentFile>('DocumentFile', schema)
