import { Schema, model } from 'mongoose'

import { DocumentFile } from '../../common/types.js'

const fileSchema = new Schema<DocumentFile>({
  data: { type: Buffer, required: true },
  type: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf'], required: true },
  name: { type: String, required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
})

export default model<DocumentFile>('DocumentFile', fileSchema)
