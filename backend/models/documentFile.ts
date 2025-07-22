import { model, Schema } from 'mongoose'
import { DocumentFile, documentFileTypes } from '../../common/types.js'
import { detectImageType } from '../../common/utils/file.js'

const fileSchema = () =>
  new Schema<DocumentFile>({
    data: { type: Buffer, required: true },
    type: { type: String, enum: documentFileTypes, required: true },
    name: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  })

const schema = fileSchema()

schema.pre('save', function (next) {
  if (this.isNew && this.type.startsWith('image/') && this.data) {
    const detectedType = detectImageType(this.data.buffer)
    if (detectedType) {
      this.type = detectedType
    }
  }
  next()
})

export default model<DocumentFile>('DocumentFile', schema)
