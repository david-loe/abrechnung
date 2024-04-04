import { Document, HydratedDocument, Model, Query, Schema, model } from 'mongoose'
import { Access, Token, User, accesses, emailRegex, locales } from '../../common/types.js'
import Settings from './settings.js'

const settings = (await Settings.findOne().lean())!

const accessObject: { [key in Access]?: { type: BooleanConstructor; default: boolean; label: string } } = {}
for (const access of accesses) {
  accessObject[access] = { type: Boolean, default: settings.defaultAccess[access], label: 'accesses.' + access }
}

const useLDAPauth = process.env.VITE_AUTH_USE_LDAP.toLocaleLowerCase() === 'true'
const useMicrosoft = process.env.VITE_AUTH_USE_MS_AZURE.toLocaleLowerCase() === 'true'
const useMagicLogin = process.env.VITE_AUTH_USE_MAGIC_LOGIN.toLocaleLowerCase() === 'true'

interface Methods {
  isActive(): Promise<boolean>
}

type UserModel = Model<User, {}, Methods>

export const userSchema = new Schema<User, UserModel, Methods>({
  fk: {
    type: {
      microsoft: { type: String, index: true, unique: true, sparse: true, label: 'Microsoft ID', hide: !useMicrosoft },
      ldapauth: { type: String, index: true, unique: true, sparse: true, label: 'LDAP UID', hide: !useLDAPauth },
      magiclogin: {
        type: String,
        index: true,
        unique: true,
        sparse: true,
        validate: emailRegex,
        label: 'Magic Login Email',
        hide: !useMagicLogin
      }
    },
    required: true
  },
  email: { type: String, unique: true, index: true, required: true, validate: emailRegex },
  name: {
    type: { givenName: { type: String, trim: true, required: true }, familyName: { type: String, trim: true, required: true } },
    required: true
  },
  access: { type: accessObject, default: () => ({}) },
  loseAccessAt: { type: Date, info: 'info.loseAccessAt' },
  settings: {
    type: {
      language: { type: String, default: process.env.VITE_I18N_LOCALE, enum: locales },
      lastCurrencies: { type: [{ type: String, ref: 'Currency' }], required: true },
      lastCountries: { type: [{ type: String, ref: 'Country' }], required: true },
      projects: { type: [{ type: Schema.Types.ObjectId, ref: 'Project' }], required: true },
      insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance' },
      organisation: { type: Schema.Types.ObjectId, ref: 'Organisation' }
    },
    required: true,
    default: () => ({})
  },
  vehicleRegistration: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }] },
  token: { type: Schema.Types.ObjectId, ref: 'Token' }
})

function populate(doc: Document) {
  return Promise.allSettled([
    doc.populate({ path: 'settings.insurance' }),
    doc.populate({ path: 'settings.organisation', select: { name: 1 } }),
    doc.populate({ path: 'settings.lastCurrencies' }),
    doc.populate({ path: 'settings.lastCountries', select: { name: 1, flag: 1, currency: 1 } }),
    doc.populate({ path: 'settings.projects' }),
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

userSchema.methods.isActive = async function (this: UserDoc) {
  if (this.access.user) {
    if (!(this.loseAccessAt && (this.loseAccessAt as Date).valueOf() <= new Date().valueOf())) {
      return true
    } else {
      for (const access of accesses) {
        this.access[access] = false
      }
      await this.save()
    }
  }
  return false
}

export default model<User>('User', userSchema)

export interface UserDoc extends Methods, HydratedDocument<User> {}
