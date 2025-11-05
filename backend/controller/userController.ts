import {
  DocumentFile,
  IdDocument,
  Token as IToken,
  User as IUser,
  idDocumentToId,
  locales,
  tokenAdminUser
} from 'abrechnung-common/types.js'
import { DeleteResult } from 'mongodb'
import { mongo, Types } from 'mongoose'
import { Body, Consumes, Delete, Get, Middlewares, Post, Queries, Query, Request, Route, Security, Tags } from 'tsoa'
import { PushSubscription } from 'web-push'
import { generateBearerToken, hashToken } from '../authStrategies/http-bearer.js'
import ENV from '../env.js'
import { documentFileHandler, fileHandler } from '../helper.js'
import i18n from '../i18n.js'
import Advance from '../models/advance.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import Token from '../models/token.js'
import Travel from '../models/travel.js'
import User, { userSchema } from '../models/user.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { sendMail } from '../notifications/mail.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { NotAllowedError, NotFoundError } from './error.js'
import { AuthenticatedExpressRequest, File } from './types.js'

@Tags('User')
@Route('user')
@Security('cookieAuth', ['user'])
@Security('httpBearer', ['user'])
export class UserController extends Controller {
  @Get()
  public getMe(@Request() request: AuthenticatedExpressRequest) {
    return { data: request.user as IUser }
  }

  @Get('token')
  public getUploadToken(@Request() request: AuthenticatedExpressRequest) {
    return { data: request.user.token }
  }

  @Delete('token')
  public async deleteUploadToken(@Request() request: AuthenticatedExpressRequest) {
    request.user.token = undefined
    await request.user.save()
  }

  @Post('token')
  public async postUploadToken(@Request() request: AuthenticatedExpressRequest) {
    const token = (await new Token().save()).toObject()
    request.user.token = token as unknown as IToken<Types.ObjectId, mongo.Binary>
    await request.user.save()
    return { message: 'alerts.successSaving', result: token }
  }

  @Post('settings')
  public async postSettings(@Body() requestBody: SetterBody<IUser['settings']>, @Request() request: AuthenticatedExpressRequest) {
    Object.assign(request.user.settings, requestBody)
    request.user.markModified('settings')
    const result = (await request.user.save()).toObject()
    return { message: 'alerts.successSaving', result: result.settings }
  }

  @Post('vehicleRegistration')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postVehicleRegistration(
    @Body() requestBody: { vehicleRegistration: File[] },
    @Request() request: AuthenticatedExpressRequest
  ) {
    await documentFileHandler(['vehicleRegistration'])(request)
    request.user.vehicleRegistration = requestBody.vehicleRegistration as unknown as DocumentFile<Types.ObjectId, mongo.Binary>[]
    request.user.markModified('vehicleRegistration')
    const result = await request.user.save()
    return { message: 'alerts.successSaving', result: result }
  }

  @Post('subscription')
  public async postPushNotificationSubscription(@Body() requestBody: PushSubscription, @Request() request: AuthenticatedExpressRequest) {
    request.session.subscription = requestBody
    return { message: 'alerts.successSaving', result: requestBody }
  }

  @Post('httpBearer')
  public async genOwnApiKey(@Request() request: AuthenticatedExpressRequest) {
    const token = generateBearerToken(request.user._id)
    request.user.fk.httpBearer = await hashToken(token)
    await request.user.save()
    return { message: 'alerts.successSaving', result: token }
  }
}

@Tags('User')
@Route('users')
@Security('cookieAuth', ['user', 'approve/advance'])
@Security('httpBearer', ['user', 'approve/advance'])
@Security('cookieAuth', ['user', 'approve/travel'])
@Security('httpBearer', ['user', 'approve/travel'])
@Security('cookieAuth', ['user', 'examine/travel'])
@Security('httpBearer', ['user', 'examine/travel'])
@Security('cookieAuth', ['user', 'examine/expenseReport'])
@Security('httpBearer', ['user', 'examine/expenseReport'])
@Security('cookieAuth', ['user', 'examine/healthCareCost'])
@Security('httpBearer', ['user', 'examine/healthCareCost'])
@Security('cookieAuth', ['user', 'book/advance'])
@Security('httpBearer', ['user', 'book/advance'])
@Security('cookieAuth', ['user', 'book/expenseReport'])
@Security('httpBearer', ['user', 'book/expenseReport'])
@Security('cookieAuth', ['user', 'book/travel'])
@Security('httpBearer', ['user', 'book/travel'])
@Security('cookieAuth', ['user', 'book/healthCareCost'])
@Security('httpBearer', ['user', 'book/healthCareCost'])
@Security('cookieAuth', ['user', 'admin'])
@Security('httpBearer', ['user', 'admin'])
export class UsersController extends Controller {
  @Get()
  public async getNamesAndProjects(@Queries() query: GetterQuery<IUser>) {
    return await this.getter(User, {
      query,
      projection: { name: 1, projects: 1, email: 1 },
      filter: { 'fk.magiclogin': { $ne: tokenAdminUser.fk.magiclogin } }
    })
  }
}

function sendNewMagicloginMail(user: IUser) {
  sendMail(
    [user],
    i18n.t('mail.newMagiclogin.subject', { lng: user.settings.language }),
    i18n.t('mail.newMagiclogin.paragraph', { lng: user.settings.language }),
    { text: i18n.t('mail.newMagiclogin.buttonText', { lng: user.settings.language }), link: ENV.VITE_FRONTEND_URL },
    i18n.t('mail.newMagiclogin.lastParagraph', { lng: user.settings.language })
  )
}

interface SetterBodyUser extends SetterBody<IUser<Types.ObjectId, mongo.Binary>> {
  loseAccessAt: null | Date | undefined
}

@Tags('User')
@Route('admin/user')
@Security('cookieAuth', ['admin'])
@Security('httpBearer', ['admin'])
export class UserAdminController extends Controller {
  @Get()
  public async get(@Queries() query: GetterQuery<IUser>) {
    return await this.getter(User, {
      query,
      projection: { vehicleRegistration: 0 },
      filter: { 'fk.magiclogin': { $ne: tokenAdminUser.fk.magiclogin } }
    })
  }

  @Post()
  public async post(@Body() requestBody: SetterBodyUser) {
    let cb: ((data: IUser) => unknown) | undefined

    if (!requestBody._id && requestBody.fk && requestBody.fk.magiclogin) {
      cb = sendNewMagicloginMail
    }
    return await this.setter(User, { requestBody: requestBody, allowNew: true, cb })
  }

  @Post('httpBearer')
  public async genAnyApiKey(@Body() requestBody: { userId: IdDocument }) {
    const user = await User.findOne({ _id: idDocumentToId(requestBody.userId) })
    if (!user) {
      throw new NotFoundError(`No user for _id: ${idDocumentToId(requestBody.userId)} found.`)
    }
    const token = generateBearerToken(user._id)
    user.fk.httpBearer = await hashToken(token)
    await user.save()
    return { message: 'alerts.successSaving', result: token }
  }

  @Post('bulk')
  public async postMany(@Body() requestBody: SetterBodyUser[]) {
    const newMagicloginUsers: number[] = []
    for (let i = 0; i < requestBody.length; i++) {
      if (!requestBody[i]._id && requestBody[i].fk?.magiclogin) {
        newMagicloginUsers.push(i)
      }
    }
    const cb = (users: IUser[]) => {
      for (const index of newMagicloginUsers) {
        sendNewMagicloginMail(users[index])
      }
    }
    return await this.insertMany(User, { requestBody, cb })
  }

  @Delete()
  public async delete(@Query() _id: string) {
    return await this.deleter(User, {
      _id,
      referenceChecks: [
        {
          model: Travel,
          paths: ['owner', 'editor', 'comments.author', 'log.-10.by', 'log.0.by', 'log.10.by', 'log.20.by', 'log.30.by', 'log.40.by'],
          conditions: { historic: false }
        },
        {
          model: ExpenseReport,
          paths: ['owner', 'editor', 'comments.author', 'log.10.by', 'log.20.by', 'log.30.by', 'log.40.by'],
          conditions: { historic: false }
        },
        {
          model: HealthCareCost,
          paths: ['owner', 'editor', 'comments.author', 'log.10.by', 'log.20.by', 'log.30.by', 'log.40.by'],
          conditions: { historic: false }
        },
        {
          model: Advance,
          paths: ['owner', 'editor', 'comments.author', 'log.-10.by', 'log.0.by', 'log.30.by', 'log.40.by'],
          conditions: { historic: false }
        }
      ]
    })
  }

  @Post('merge')
  public async merge(@Body() requestBody: { userId: IdDocument; userIdToOverwrite: IdDocument }, @Query() delOverwritten?: boolean) {
    if (idDocumentToId(requestBody.userId) === idDocumentToId(requestBody.userIdToOverwrite)) {
      throw new NotAllowedError('Users are the same.')
    }
    const user = await User.findOne({ _id: idDocumentToId(requestBody.userId) })
    if (!user) {
      throw new NotFoundError(`No user for _id: ${idDocumentToId(requestBody.userId)} found.`)
    }
    const userIdToOverwrite = new Types.ObjectId(idDocumentToId(requestBody.userIdToOverwrite))
    const userToOverwrite = await User.findOne({ _id: userIdToOverwrite }).lean()

    let deleteResult: DeleteResult | null = null
    if (delOverwritten) {
      deleteResult = await User.deleteOne({ _id: userIdToOverwrite })
    }

    const unmergedUser = user.toObject()
    let mergedUser: IUser | undefined
    if (userToOverwrite) {
      mergedUser = await user.merge(userToOverwrite, Boolean(delOverwritten))
    }

    const replacedReferences = await user.replaceReferences(userIdToOverwrite)

    return { result: { mergedUser: mergedUser || unmergedUser, replacedReferences, deleteResult }, message: 'alerts.successSaving' }
  }
  @Get('form')
  public async getForm() {
    return { data: mongooseSchemaToVueformSchema((await userSchema()).obj, locales) }
  }
}
