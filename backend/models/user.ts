import mongoose, { Document, HydratedDocument, Model, Query, Schema, Types, model } from 'mongoose'
import {
  Access,
  Token,
  User,
  UserReplaceReferencesResult,
  accesses,
  emailRegex,
  locales,
  userReplaceCollections
} from '../../common/types.js'
import Settings from './settings.js'

const settings = (await Settings.findOne().lean())!

const accessObject: { [key in Access]?: { type: BooleanConstructor; default: boolean; label: string } } = {}
for (const access of accesses) {
  accessObject[access] = { type: Boolean, default: settings.defaultAccess[access], label: 'accesses.' + access }
}

const useLDAPauth = process.env.VITE_AUTH_USE_LDAP.toLowerCase() === 'true'
const useMicrosoft = process.env.VITE_AUTH_USE_MS_AZURE.toLowerCase() === 'true'
const useMagicLogin = process.env.VITE_AUTH_USE_MAGIC_LOGIN.toLowerCase() === 'true'

interface Methods {
  isActive(): Promise<boolean>
  replaceReferences(userIdToOverwrite: Types.ObjectId): Promise<UserReplaceReferencesResult>
  merge(userToOverwrite: Partial<User>, mergeFk: boolean): Promise<User>
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
  vehicleRegistration: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }], hide: true },
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

userSchema.methods.replaceReferences = async function (this: UserDoc, userIdToOverwrite: Types.ObjectId) {
  const filter = (path: string) => {
    let filter: any = {}
    filter[path] = userIdToOverwrite
    return filter
  }
  const update = (path: string) => {
    let update = { $set: {} as any }
    update.$set[path] = this._id
    return update
  }
  const arrayFilter = (path: string) => {
    const arrayFilter = { arrayFilters: [] as any[] }
    let filter: any = {}
    if (path === '') {
      filter['elem'] = userIdToOverwrite
    } else {
      filter['elem.' + path] = userIdToOverwrite
    }
    arrayFilter.arrayFilters.push(filter)
    return arrayFilter
  }
  const result: UserReplaceReferencesResult = {}
  for (const collection of userReplaceCollections) {
    result[collection] = await mongoose.connection.collection(collection).updateMany(filter('owner'), update('owner'))
    await mongoose.connection.collection(collection).updateMany(filter('editor'), update('editor'))
    await mongoose.connection
      .collection(collection)
      .updateMany(filter('comments.author'), update('comments.$[elem].author'), arrayFilter('author'))
  }
  result['documentfiles'] = await mongoose.connection.collection('documentfiles').updateMany(filter('owner'), update('owner'))
  return result
}

userSchema.methods.merge = async function (this: UserDoc, userToOverwrite: Partial<User>, mergeFk: boolean) {
  const thisPojo = this.toObject()
  if (mergeFk) {
    Object.assign(this.fk, userToOverwrite.fk, thisPojo.fk)
    delete userToOverwrite.fk
  }

  for (const access in userToOverwrite.access!) {
    if (userToOverwrite.access[access as Access]) {
      this.access[access as Access] = true
    }
  }
  delete userToOverwrite.access

  Object.assign(this.settings, userToOverwrite.settings, thisPojo.settings)
  for (const p of userToOverwrite.settings!.projects) {
    if (!this.settings.projects.some((tp) => tp._id.equals(p._id))) {
      this.settings.projects.push(p)
    }
  }
  delete userToOverwrite.settings

  Object.assign(this, userToOverwrite, this.toObject())
  await this.save()
  return this.toObject()
}

export default model<User, UserModel>('User', userSchema)

export interface UserDoc extends Methods, HydratedDocument<User> {}
