import { model, Schema } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'

const tokenSchema = () =>
  new Schema(
    { files: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }] }, expireAt: { type: Date, expires: 0 } },
    { timestamps: true }
  )
const schema = tokenSchema()

schema.pre('save', async function () {
  if (this.isNew) {
    this.expireAt = new Date(Date.now() + BACKEND_CACHE.settings.uploadTokenExpireAfterSeconds * 1_000)
  }
})

export default model('Token', schema)
