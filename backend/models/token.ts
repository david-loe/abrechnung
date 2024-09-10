import { Schema, model } from 'mongoose'
import { getSettings } from '../helper.js'

const settings = await getSettings()

const tokenSchema = new Schema(
  {
    files: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }] }
  },
  { timestamps: true }
)

// TODO: When changing settings.uploadTokenExpireAfterSeconds the index has to be recreated
tokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: settings.uploadTokenExpireAfterSeconds })

export default model('Token', tokenSchema)
