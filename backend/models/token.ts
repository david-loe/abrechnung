import mongoose from 'mongoose'
import settings from '../../common/settings.json'

const tokenSchema = new mongoose.Schema(
  {
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'DocumentFile' }]
  },
  { timestamps: true }
)

tokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: settings.uploadTokenExpireAfterSeconds })

export default mongoose.model('Token', tokenSchema)
