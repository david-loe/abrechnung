import { Schema, model } from 'mongoose'

import { DocumentFile, documentFileTypes } from '../../common/types.js'

const fileSchema = () =>
  new Schema<DocumentFile>({
    data: { type: Buffer, required: true },
    type: { type: String, enum: documentFileTypes, required: true },
    name: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  })

export default model<DocumentFile>('DocumentFile', fileSchema())
