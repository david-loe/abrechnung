import mongoose, { Schema, model } from 'mongoose'
import { Settings } from '../../common/types.js'

const settings = (await mongoose.connection.collection('settings').findOne({})) as Settings

const tokenSchema = new Schema(
  {
    files: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }]
  },
  { timestamps: true }
)

tokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: settings.uploadTokenExpireAfterSeconds })

export default model('Token', tokenSchema)
