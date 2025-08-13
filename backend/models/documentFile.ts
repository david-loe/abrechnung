import { DocumentFile, documentFileTypes } from 'abrechnung-common/types.js'
import { detectImageType } from 'abrechnung-common/utils/file.js'
import { model, mongo, Schema, Types } from 'mongoose'

const fileSchema = () =>
  new Schema<DocumentFile<Types.ObjectId, mongo.Binary>>({
    data: { type: Buffer, required: true },
    type: { type: String, enum: documentFileTypes, required: true },
    name: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  })

const schema = fileSchema()

schema.pre('save', function (next) {
  if (this.isNew && this.type.startsWith('image/') && this.data) {
    // Wrong type in mongodb BSON Binary, so need assertion here
    const detectedType = detectImageType(this.data.buffer as unknown as ArrayBuffer)
    if (detectedType) {
      this.type = detectedType
    }
  }
  next()
})

export default model<DocumentFile<Types.ObjectId, mongo.Binary>>('DocumentFile', schema)
