import { Schema, Document, model, Query } from 'mongoose'
import { Access, Token, User, accesses } from '../../common/types.js'

const accessObject: { [key in Access]?: any } = {}
for (const access of accesses) {
  accessObject[access] = { type: Boolean, default: false }
}

const userSchema = new Schema<User>({
  fk: {
    microsoft: { type: String, index: true, unique: true, sparse: true },
    ldapauth: { type: String, index: true, unique: true, sparse: true },
    magiclogin: { type: String, index: true, unique: true, sparse: true }
  },
  email: { type: String, unique: true, index: true, required: true },
  name: { givenName: { type: String, trim: true, required: true }, familyName: { type: String, trim: true, required: true } },
  access: accessObject,
  settings: {
    language: { type: String, default: 'de' },
    lastCurrencies: [{ type: String, ref: 'Currency' }],
    lastCountries: [{ type: String, ref: 'Country' }],
    insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance' },
    organisation: { type: Schema.Types.ObjectId, ref: 'Organisation' }
  },
  vehicleRegistration: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }],
  token: { type: Schema.Types.ObjectId, ref: 'Token' }
})

function populate(doc: Document) {
  return Promise.allSettled([
    doc.populate({ path: 'settings.insurance' }),
    doc.populate({ path: 'settings.organisation', select: { name: 1 } }),
    doc.populate({ path: 'settings.lastCurrencies' }),
    doc.populate({ path: 'settings.lastCountries', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'vehicleRegistration', select: { name: 1, type: 1 } }),
    doc.populate<{ token: Token }>({ path: 'token', populate: { path: 'files', select: { name: 1, type: 1 } } })
  ])
}

userSchema.pre(/^find((?!Update).)*$/, function () {
  const projection = (this as Query<User, User>).projection()
  const popInProj: boolean = projection && (projection.settings || projection.vehicleRegistration || projection.token)
  if ((this as Query<User, User>).selectedExclusively() && popInProj) {
    return
  }
  if ((this as Query<User, User>).selectedInclusively() && !popInProj) {
    return
  }
  populate(this as Document)
})

userSchema.pre('save', async function (next) {
  await populate(this)
  next()
})

export default model<User>('User', userSchema)
