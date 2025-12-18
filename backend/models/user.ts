import {
  Access,
  accesses,
  emailRegex,
  locales,
  User,
  UserReplaceReferencesResult,
  userReplaceCollections
} from 'abrechnung-common/types.js'
import mongoose, { HydratedDocument, Model, model, mongo, Query, Schema, Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'
import { populateAll, populateSelected } from './helper.js'

interface Methods {
  isActive(): Promise<boolean>
  replaceReferences(userIdToOverwrite: Types.ObjectId): Promise<UserReplaceReferencesResult>
  merge(userToOverwrite: User<Types.ObjectId, mongo.Binary>, mergeFk: boolean): Promise<User<Types.ObjectId, mongo.Binary>>
  addProjects(projects: { assigned?: Types.ObjectId[]; supervised?: Types.ObjectId[] }): Promise<void>
}

// biome-ignore lint/complexity/noBannedTypes: mongoose uses {} as type
type UserModel = Model<User<Types.ObjectId, mongo.Binary>, {}, Methods>

export const userSchema = async () => {
  const accessObject: { [key in Access]?: { type: BooleanConstructor; default: boolean; label: string } } = {}
  for (const access of accesses) {
    accessObject[access] = { type: Boolean, default: BACKEND_CACHE.settings.defaultAccess[access], label: `accesses.${access}` }
  }
  return new Schema<User<Types.ObjectId, mongo.Binary>, UserModel, Methods>({
    fk: {
      type: {
        microsoft: {
          type: String,
          index: true,
          unique: true,
          sparse: true,
          label: 'Microsoft ID',
          hide: !BACKEND_CACHE.displaySettings.auth.microsoft
        },
        oidc: { type: String, index: true, unique: true, sparse: true, label: 'OIDC ID', hide: !BACKEND_CACHE.displaySettings.auth.oidc },
        ldapauth: {
          type: String,
          index: true,
          unique: true,
          sparse: true,
          label: 'LDAP UID',
          hide: !BACKEND_CACHE.displaySettings.auth.ldapauth
        },
        magiclogin: {
          type: String,
          index: true,
          unique: true,
          sparse: true,
          validate: emailRegex,
          trim: true,
          label: 'Magic Login Email',
          hide: !BACKEND_CACHE.displaySettings.auth.magiclogin
        },
        httpBearer: { type: String, index: true, unique: true, sparse: true, label: 'API Key Hash' }
      },
      required: true
    },
    email: { type: String, unique: true, index: true, required: true, validate: emailRegex, trim: true },
    name: {
      type: { givenName: { type: String, trim: true, required: true }, familyName: { type: String, trim: true, required: true } },
      required: true
    },
    access: { type: accessObject, default: () => ({}) },
    loseAccessAt: { type: Date, info: 'info.loseAccessAt' },
    projects: {
      type: {
        assigned: { type: [{ type: Schema.Types.ObjectId, ref: 'Project' }], required: true, label: 'labels.assignedProjects' },
        supervised: {
          type: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
          required: true,
          label: 'labels.supervisedProjects',
          conditions: [
            [
              ['access.approve/advance', true],
              ['access.approve/travel', true],
              ['access.examine/travel', true],
              ['access.examine/expenseReport', true],
              ['access.examine/healthCareCost', true],
              ['access.book/advance', true],
              ['access.book/travel', true],
              ['access.book/expenseReport', true],
              ['access.book/healthCareCost', true]
            ]
          ]
        }
      },
      required: true,
      default: () => ({})
    },

    settings: {
      type: {
        language: {
          type: String,
          default: BACKEND_CACHE.displaySettings.locale.default,
          enum: locales,
          required: true,
          translationPrefix: 'languages.'
        },
        hasUserSetLanguage: { type: Boolean, required: true, default: false, hide: true },
        lastCurrencies: { type: [{ type: String, ref: 'Currency' }], required: true, hide: true },
        lastCountries: { type: [{ type: String, ref: 'Country' }], required: true, hide: true },
        insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance', hide: BACKEND_CACHE.settings.disableReportType.healthCareCost },
        organisation: { type: Schema.Types.ObjectId, ref: 'Organisation' },
        showInstallBanner: { type: Boolean, required: true, default: true, hide: true }
      },
      required: true,
      default: () => ({})
    },
    vehicleRegistration: { type: [{ type: Schema.Types.ObjectId, ref: 'DocumentFile' }], hide: true },
    token: { type: Schema.Types.ObjectId, ref: 'Token' }
  })
}

const schema = await userSchema()

const populates = {
  settings: [
    { path: 'settings.insurance' },
    { path: 'settings.organisation', select: { name: 1 } },
    { path: 'settings.lastCurrencies' },
    { path: 'settings.lastCountries', select: { name: 1, flag: 1, currency: 1, needsA1Certificate: 1 } }
  ],
  projects: [{ path: 'projects.assigned' }],
  vehicleRegistration: [{ path: 'vehicleRegistration', select: { name: 1, type: 1 } }],
  token: [{ path: 'token', populate: { path: 'files', select: { name: 1, type: 1 } } }]
}
schema.pre(/^find((?!Update).)*$/, async function (this: Query<User<Types.ObjectId, mongo.Binary>, User<Types.ObjectId, mongo.Binary>>) {
  await populateSelected(this, populates)
})

schema.pre('save', async function () {
  await populateAll(this, populates)
})

schema.methods.isActive = async function (this: UserDoc) {
  if (this.access.user) {
    if (!(this.loseAccessAt && (this.loseAccessAt as Date).valueOf() <= Date.now())) {
      return true
    }
    for (const access of accesses) {
      this.access[access] = false
    }
    await this.save()
  }
  return false
}

type StringIdMap = Record<string, Types.ObjectId>
schema.methods.replaceReferences = async function (this: UserDoc, userIdToOverwrite: Types.ObjectId) {
  const filter = (path: string) => {
    const filter: StringIdMap = {}
    filter[path] = userIdToOverwrite
    return filter
  }
  const update = (path: string) => {
    const update = { $set: {} as StringIdMap }
    update.$set[path] = this._id
    return update
  }
  const arrayFilter = (path: string) => {
    const arrayFilter = { arrayFilters: [] as StringIdMap[] }
    const filter: StringIdMap = {}
    if (path === '') {
      filter.elem = userIdToOverwrite
    } else {
      filter[`elem.${path}`] = userIdToOverwrite
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
    await mongoose.connection.collection(collection).updateMany(filter('log.-10.by'), update('log.-10.by'))
    await mongoose.connection.collection(collection).updateMany(filter('log.0.by'), update('log.0.by'))
    await mongoose.connection.collection(collection).updateMany(filter('log.10.by'), update('log.10.by'))
    await mongoose.connection.collection(collection).updateMany(filter('log.20.by'), update('log.20.by'))
    await mongoose.connection.collection(collection).updateMany(filter('log.30.by'), update('log.30.by'))
    await mongoose.connection.collection(collection).updateMany(filter('log.40.by'), update('log.40.by'))
  }
  result.documentfiles = await mongoose.connection.collection('documentfiles').updateMany(filter('owner'), update('owner'))
  return result
}

schema.methods.merge = async function (this: UserDoc, userToOverwrite: User<Types.ObjectId, mongo.Binary>, mergeFk: boolean) {
  const thisPojo = this.toObject()
  if (mergeFk) {
    Object.assign(this.fk, userToOverwrite.fk, thisPojo.fk)
    ;(userToOverwrite as Partial<User<Types.ObjectId, mongo.Binary>>).fk = undefined
  }

  for (const access in userToOverwrite.access) {
    if (userToOverwrite.access[access as Access]) {
      this.access[access as Access] = true
    }
  }
  ;(userToOverwrite as Partial<User<Types.ObjectId, mongo.Binary>>).access = undefined

  for (const p of userToOverwrite.projects.assigned) {
    if (!this.projects.assigned.some((tp) => tp._id.equals(p._id))) {
      this.projects.assigned.push(p)
    }
  }

  for (const p of userToOverwrite.projects.supervised) {
    if (!this.projects.supervised.some((tp) => tp._id.equals(p._id))) {
      this.projects.supervised.push(p)
    }
  }

  Object.assign(this.settings, userToOverwrite.settings, thisPojo.settings)
  ;(userToOverwrite as Partial<User<Types.ObjectId, mongo.Binary>>).settings = undefined

  Object.assign(this, userToOverwrite, this.toObject())
  await this.save()
  return this.toObject()
}

schema.methods.addProjects = async function addProjects(projects: { assigned?: Types.ObjectId[]; supervised?: Types.ObjectId[] }) {
  let changed = false
  if (projects.assigned) {
    for (const newProjectId of projects.assigned) {
      if (!this.projects.assigned.some((p) => p._id.equals(newProjectId))) {
        changed = true
        // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
        this.projects.assigned.push(newProjectId as any)
      }
    }
  }
  if (projects.supervised) {
    for (const newProjectId of projects.supervised) {
      if (!this.projects.supervised.some((p) => p._id.equals(newProjectId))) {
        changed = true
        this.projects.supervised.push(newProjectId)
      }
    }
  }
  if (changed) {
    this.save()
  }
}

export default model<User<Types.ObjectId, mongo.Binary>, UserModel>('User', schema)

export interface UserDoc extends Methods, HydratedDocument<User<Types.ObjectId, mongo.Binary>> {}
