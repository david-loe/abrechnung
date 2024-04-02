import { Schema, model } from 'mongoose'
import Settings from './settings.js'

const settings = (await Settings.findOne().lean())!

const tokenSchema = new Schema(
  {
    files: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }] }
  },
  { timestamps: true }
)

tokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: settings.uploadTokenExpireAfterSeconds })

export default model('Token', tokenSchema)
