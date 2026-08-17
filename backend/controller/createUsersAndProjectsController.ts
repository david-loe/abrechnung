import { Body, Get, Post, Queries, Route, Security, Tags } from '@tsoa/runtime'
import {
  accesses,
  BankAccount,
  Project as IProject,
  User as IUser,
  Locale,
  locales,
  Name,
  tokenAdminUser
} from 'abrechnung-common/types.js'
import { Types } from 'mongoose'
import { BACKEND_CACHE } from '../db.js'
import Project, { projectSchema, projectUsersSchema } from '../models/project.js'
import User, { userSchema } from '../models/user.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery } from './controller.js'
import { sendNewMagicloginMail } from './userController.js'

interface CreateUserSettings {
  language?: Locale
  insurance?: string | null
  organisation?: string | null
  bankAccount?: BankAccount | null
}

interface CreateUserProjects {
  assigned?: string[]
  supervised?: string[]
}

interface CreateUserBody {
  name: Name
  email: string
  employeeId?: string | null
  fk?: { magiclogin?: string | null }
  additionalDetails?: string | null
  loseAccessAt?: Date | null
  projects?: CreateUserProjects
  settings?: CreateUserSettings
}

interface CreateProjectBody {
  identifier: string
  organisation: string
  name?: string | null
  budget?: { amount?: number | null }
  balance?: { amount: number }
  assignees?: string[]
  supervisors?: string[]
}

const creatorUserProjection = {
  name: 1,
  email: 1,
  employeeId: 1,
  'fk.magiclogin': 1,
  additionalDetails: 1,
  loseAccessAt: 1,
  projects: 1,
  'settings.language': 1,
  'settings.insurance': 1,
  'settings.organisation': 1,
  'settings.bankAccount': 1
} as const

function createUserDocument(requestBody: CreateUserBody) {
  const magiclogin = requestBody.fk?.magiclogin?.trim() || requestBody.email
  return {
    name: requestBody.name,
    email: requestBody.email,
    ...(requestBody.employeeId == null ? {} : { employeeId: requestBody.employeeId }),
    fk: { magiclogin },
    access: Object.fromEntries(accesses.map((access) => [access, BACKEND_CACHE.settings.defaultAccess[access]])),
    ...(requestBody.additionalDetails == null ? {} : { additionalDetails: requestBody.additionalDetails }),
    loseAccessAt: requestBody.loseAccessAt,
    projects: requestBody.projects,
    settings: requestBody.settings
  }
}

function creationUserView(user: IUser) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    employeeId: user.employeeId,
    fk: { magiclogin: user.fk.magiclogin },
    additionalDetails: user.additionalDetails,
    loseAccessAt: user.loseAccessAt,
    projects: user.projects,
    settings: {
      language: user.settings.language,
      insurance: user.settings.insurance,
      organisation: user.settings.organisation,
      bankAccount: user.settings.bankAccount
    }
  }
}

async function sendMagicloginMailIfEnabled(user: IUser) {
  if (BACKEND_CACHE.displaySettings.auth.magiclogin && user.fk.magiclogin) {
    await sendNewMagicloginMail(user)
  }
}

const supervisorAccesses = [
  'approve/advance',
  'approve/travel',
  'examine/travel',
  'examine/expenseReport',
  'examine/healthCareCost',
  'book/advance',
  'book/travel',
  'book/expenseReport',
  'book/healthCareCost'
] as const

@Tags('Create Users and Projects')
@Route('create/user')
@Security('cookieAuth', ['create/usersAndProjects'])
@Security('httpBearer', ['create/usersAndProjects'])
export class CreateUserController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<IUser>) {
    return await this.getter(User, {
      query,
      projection: creatorUserProjection,
      filter: { 'fk.magiclogin': { $ne: tokenAdminUser.fk.magiclogin } }
    })
  }

  @Post()
  public async post(@Body() requestBody: CreateUserBody) {
    const user = await new User(createUserDocument(requestBody)).save()
    await sendMagicloginMailIfEnabled(user as unknown as IUser)
    return { message: 'alerts.successSaving', result: creationUserView(user.toObject() as unknown as IUser) }
  }

  @Post('bulk')
  public async postMany(@Body() requestBody: CreateUserBody[]) {
    const users = await User.insertMany(requestBody.map(createUserDocument))
    for (const user of users) {
      await sendMagicloginMailIfEnabled(user as unknown as IUser)
    }
    return { message: 'alerts.successSaving', result: users.map((user) => creationUserView(user.toObject() as unknown as IUser)) }
  }

  @Get('form')
  public async getForm() {
    const schema = mongooseSchemaToVueformSchema((await userSchema()).obj, locales)
    for (const field of ['access', 'token', 'vehicleRegistration', '_id']) {
      delete schema[field]
    }
    if (schema.fk?.schema) {
      for (const field of Object.keys(schema.fk.schema)) {
        if (field !== 'magiclogin') delete schema.fk.schema[field]
      }
    }
    if (schema.settings?.schema) {
      for (const field of Object.keys(schema.settings.schema)) {
        if (!['language', 'insurance', 'organisation', 'bankAccount'].includes(field)) delete schema.settings.schema[field]
      }
    }
    if (schema.projects?.schema?.supervised) {
      if (supervisorAccesses.some((access) => BACKEND_CACHE.settings.defaultAccess[access])) {
        delete schema.projects.schema.supervised.conditions
      } else {
        delete schema.projects.schema.supervised
      }
    }
    return { data: schema }
  }
}

function createProjectDocument(requestBody: CreateProjectBody) {
  return {
    identifier: requestBody.identifier,
    organisation: requestBody.organisation,
    ...(requestBody.name == null ? {} : { name: requestBody.name }),
    budget: requestBody.budget,
    balance: requestBody.balance
  }
}

async function assignProjectUsers(projectId: Types.ObjectId, requestBody: CreateProjectBody) {
  await Promise.all([
    ...(requestBody.assignees ?? []).map(async (userId) => {
      await (await User.findOne({ _id: userId }))?.addProjects({ assigned: [projectId] })
    }),
    ...(requestBody.supervisors ?? []).map(async (userId) => {
      await (await User.findOne({ _id: userId }))?.addProjects({ supervised: [projectId] })
    })
  ])
}

@Tags('Create Users and Projects')
@Route('create/project')
@Security('cookieAuth', ['create/usersAndProjects'])
@Security('httpBearer', ['create/usersAndProjects'])
export class CreateProjectController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<IProject>) {
    return await this.getter(Project, { query, sort: { identifier: 1 } })
  }

  @Post()
  public async post(@Body() requestBody: CreateProjectBody) {
    const project = await new Project(createProjectDocument(requestBody)).save()
    await assignProjectUsers(project._id, requestBody)
    return { message: 'alerts.successSaving', result: project.toObject() }
  }

  @Post('bulk')
  public async postMany(@Body() requestBody: CreateProjectBody[]) {
    const projects = await Project.insertMany(requestBody.map(createProjectDocument))
    await Promise.all(projects.map((project, index) => assignProjectUsers(project._id, requestBody[index])))
    return { message: 'alerts.successSaving', result: projects.map((project) => project.toObject()) }
  }

  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema(Object.assign(projectSchema().obj, projectUsersSchema.obj), locales, {}, false) }
  }
}
