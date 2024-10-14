import { HydratedDocument, Schema, model } from 'mongoose'
import { getSettings } from '../helper.js'

const tokenSchema = new Schema(
  {
    files: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }] },
    expireAt: { type: Date, expires: 0 }
  },
  { timestamps: true }
)

tokenSchema.pre('save', async function (this: HydratedDocument<any>) {
  if (this.isNew) {
    const settings = await getSettings()
    this.expireAt = new Date(new Date().valueOf() + settings.uploadTokenExpireAfterSeconds * 1000)
  }
})

export default model('Token', tokenSchema)
