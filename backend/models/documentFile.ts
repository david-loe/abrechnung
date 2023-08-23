import { Schema, model } from 'mongoose'

import { DocumentFile } from '../../common/types.js'

const fileSchema = new Schema<DocumentFile>({
  data: { type: Buffer },
  type: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf'] },
  name: { type: String },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
})

export default model<DocumentFile>('DocumentFile', fileSchema)
