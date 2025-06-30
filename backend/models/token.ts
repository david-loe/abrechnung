import { HydratedDocument, model, Schema } from 'mongoose'
import { Token } from '../../common/types.js'
import { getSettings } from '../db.js'

const tokenSchema = () =>
  new Schema(
    { files: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }] }, expireAt: { type: Date, expires: 0 } },
    { timestamps: true }
  )
const schema = tokenSchema()

schema.pre('save', async function (this: HydratedDocument<Token>) {
  if (this.isNew) {
    const settings = await getSettings()
    this.expireAt = new Date(Date.now() + settings.uploadTokenExpireAfterSeconds * 1000)
  }
})

export default model('Token', schema)
