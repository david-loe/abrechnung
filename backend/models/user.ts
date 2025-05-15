import mongoose, { HydratedDocument, Model, Query, Schema, Types, model } from 'mongoose'
import {
  Access,
  User,
  UserReplaceReferencesResult,
  _id,
  accesses,
  emailRegex,
  locales,
  userReplaceCollections
} from '../../common/types.js'
import { getDisplaySettings, getSettings } from '../db.js'
import { populateAll, populateSelected } from './helper.js'

interface Methods {
  isActive(): Promise<boolean>
  replaceReferences(userIdToOverwrite: Types.ObjectId): Promise<UserReplaceReferencesResult>
  merge(userToOverwrite: User, mergeFk: boolean): Promise<User>
  addProjects(projects: { assigned?: _id[]; supervised?: _id[] }): Promise<void>
}

type UserModel = Model<User, {}, Methods>

export const userSchema = async () => {
  const settings = await getSettings()
  const displaySettings = await getDisplaySettings()

  const accessObject: { [key in Access]?: { type: BooleanConstructor; default: boolean; label: string } } = {}
  for (const access of accesses) {
    accessObject[access] = { type: Boolean, default: settings.defaultAccess[access], label: `accesses.${access}` }
  }
  return new Schema<User, UserModel, Methods>({
    fk: {
      type: {
        microsoft: { type: String, index: true, unique: true, sparse: true, label: 'Microsoft ID', hide: !displaySettings.auth.microsoft },
        oidc: { type: String, index: true, unique: true, sparse: true, label: 'OIDC ID', hide: !displaySettings.auth.oidc },
        ldapauth: { type: String, index: true, unique: true, sparse: true, label: 'LDAP UID', hide: !displaySettings.auth.ldapauth },
        magiclogin: {
          type: String,
          index: true,
          unique: true,
          sparse: true,
          validate: emailRegex,
          label: 'Magic Login Email',
          hide: !displaySettings.auth.magiclogin
        },
        httpBearer: {
          type: String,
          index: true,
          unique: true,
          sparse: true,
          label: 'API Key Hash'
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
    projects: {
      type: {
        assigned: { type: [{ type: Schema.Types.ObjectId, ref: 'Project' }], required: true, label: 'labels.assignedProjects' },
        supervised: {
          type: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
          required: true,
          label: 'labels.supervisedProjects',
          conditions: [
            [
              ['access.approve/travel', true],
              ['access.examine/travel', true],
              ['access.examine/expenseReport', true],
              ['access.examine/healthCareCost', true],
              ['access.confirm/healthCareCost', true],
              ['access.refunded/travel', true],
              ['access.refunded/expenseReport', true],
              ['access.refunded/healthCareCost', true]
            ]
          ]
        }
      },
      required: true,
      default: () => ({})
    },

    settings: {
      type: {
        language: { type: String, default: displaySettings.locale.default, enum: locales },
        lastCurrencies: { type: [{ type: String, ref: 'Currency' }], required: true },
        lastCountries: { type: [{ type: String, ref: 'Country' }], required: true },
        insurance: { type: Schema.Types.ObjectId, ref: 'HealthInsurance' },
        organisation: { type: Schema.Types.ObjectId, ref: 'Organisation' },
        showInstallBanner: { type: Boolean, required: true, default: true }
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
schema.pre(/^find((?!Update).)*$/, function (this: Query<User, User>) {
  return populateSelected(this, populates)
})

schema.pre('save', async function (next) {
  await populateAll(this, populates)
  next()
})

schema.methods.isActive = async function (this: UserDoc) {
  if (this.access.user) {
    if (!(this.loseAccessAt && (this.loseAccessAt as Date).valueOf() <= new Date().valueOf())) {
      return true
    }
    for (const access of accesses) {
      this.access[access] = false
    }
    await this.save()
  }
  return false
}

schema.methods.replaceReferences = async function (this: UserDoc, userIdToOverwrite: Types.ObjectId) {
  const filter = (path: string) => {
    const filter: any = {}
    filter[path] = userIdToOverwrite
    return filter
  }
  const update = (path: string) => {
    const update = { $set: {} as any }
    update.$set[path] = this._id
    return update
  }
  const arrayFilter = (path: string) => {
    const arrayFilter = { arrayFilters: [] as any[] }
    const filter: any = {}
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
  }
  result.documentfiles = await mongoose.connection.collection('documentfiles').updateMany(filter('owner'), update('owner'))
  return result
}

schema.methods.merge = async function (this: UserDoc, userToOverwrite: User, mergeFk: boolean) {
  const thisPojo = this.toObject()
  if (mergeFk) {
    Object.assign(this.fk, userToOverwrite.fk, thisPojo.fk)
    ;(userToOverwrite as Partial<User>).fk = undefined
  }

  for (const access in userToOverwrite.access) {
    if (userToOverwrite.access[access as Access]) {
      this.access[access as Access] = true
    }
  }
  ;(userToOverwrite as Partial<User>).access = undefined

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
  ;(userToOverwrite as Partial<User>).settings = undefined

  Object.assign(this, userToOverwrite, this.toObject())
  await this.save()
  return this.toObject()
}

schema.methods.addProjects = async function addProjects(projects: { assigned?: _id[]; supervised?: _id[] }) {
  let changed = false
  if (projects.assigned) {
    for (const newProjectId of projects.assigned) {
      if (!this.projects.assigned.some((p) => p._id.equals(newProjectId))) {
        changed = true
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

export default model<User, UserModel>('User', schema)

export interface UserDoc extends Methods, HydratedDocument<User> {}
