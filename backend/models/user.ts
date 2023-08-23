import { Schema, Document, model } from 'mongoose'
import { Token, User } from '../../common/types.js'

const userSchema = new Schema<User>({
  uid: { type: String, required: true, unique: true, index: true },
  email: { type: String },
  name: { type: String },
  access: {
    examine: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
    admin: { type: Boolean, default: false }
  },
  settings: {
    language: { type: String, default: 'de' },
    lastCurrencies: [{ type: String, ref: 'Currency' }],
    lastCountries: [{ type: String, ref: 'Country' }]
  },
  vehicleRegistration: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }],
  token: { type: Schema.Types.ObjectId, ref: 'Token' }
})

function populate(doc: Document) {
  return Promise.allSettled([
    doc.populate({ path: 'settings.lastCurrencies' }),
    doc.populate({ path: 'settings.lastCountries', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'vehicleRegistration', select: { name: 1, type: 1 } }),
    doc.populate<{ token: Token }>({ path: 'token', populate: { path: 'files', select: { name: 1, type: 1 } } })
  ])
}

userSchema.pre(/^find((?!Update).)*$/, function () {
  populate(this as Document)
})

userSchema.pre('save', async function (next) {
  await populate(this)
  next()
})

export default model<User>('User', userSchema)
