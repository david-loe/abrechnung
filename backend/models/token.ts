import { Schema, model } from 'mongoose'
import settings from '../../common/settings.json' assert { type: 'json' }

const tokenSchema = new Schema(
  {
    files: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }]
  },
  { timestamps: true }
)

tokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: settings.uploadTokenExpireAfterSeconds })

export default model('Token', tokenSchema)
