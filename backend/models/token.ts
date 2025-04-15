import { HydratedDocument, Schema, model } from 'mongoose'
import { getSettings } from '../db.js'

const tokenSchema = () =>
  new Schema(
    {
      files: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }] },
      expireAt: { type: Date, expires: 0 }
    },
    { timestamps: true }
  )
const schema = tokenSchema()

schema.pre('save', async function (this: HydratedDocument<any>) {
  if (this.isNew) {
    const settings = await getSettings()
    this.expireAt = new Date(new Date().valueOf() + settings.uploadTokenExpireAfterSeconds * 1000)
  }
})

export default model('Token', schema)
