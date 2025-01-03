import { Request as ExRequest } from 'express'
import { DeleteResult } from 'mongodb'
import { Types } from 'mongoose'
import { Body, Consumes, Delete, Get, Middlewares, Post, Queries, Query, Request, Route, Security } from 'tsoa'
import { _id, User as IUser, locales, tokenAdminUser } from '../../common/types.js'
import { documentFileHandler, fileHandler } from '../helper.js'
import i18n from '../i18n.js'
import { sendMail } from '../mail/mail.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import Token from '../models/token.js'
import Travel from '../models/travel.js'
import User, { userSchema } from '../models/user.js'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'
import { Controller, GetterQuery, SetterBody } from './controller.js'
import { NotAllowedError, NotFoundError } from './error.js'
import { File, IdDocument, idDocumentToId } from './types.js'

@Route('user')
@Security('cookieAuth', ['user'])
export class UserController extends Controller {
  @Get()
  public getMe(@Request() request: ExRequest) {
    return { data: request.user! as IUser }
  }

  @Get('token')
  public getToken(@Request() request: ExRequest) {
    return { data: request.user!.token }
  }

  @Delete('token')
  public async deleteToken(@Request() request: ExRequest) {
    request.user!.token = undefined
    await request.user!.save()
  }

  @Post('token')
  public async postToken(@Request() request: ExRequest) {
    const token = (await new Token().save()).toObject()
    request.user!.token = token as unknown as any
    await request.user!.save()
    return { message: 'alerts.successSaving', result: token }
  }

  @Post('settings')
  public async postSettings(@Body() requestBody: SetterBody<IUser['settings']>, @Request() request: ExRequest) {
    Object.assign(request.user!.settings, requestBody)
    request.user!.markModified('settings')
    const result = (await request.user!.save()).toObject()
    return { message: 'alerts.successSaving', result: result.settings }
  }

  @Post('vehicleRegistration')
  @Middlewares(fileHandler.any())
  @Consumes('multipart/form-data')
  public async postVehicleRegistration(@Body() requestBody: { vehicleRegistration: File[] }, @Request() request: ExRequest) {
    await documentFileHandler(['vehicleRegistration'])(request)
    request.user!.vehicleRegistration = requestBody.vehicleRegistration as unknown as any
    request.user!.markModified('vehicleRegistration')
    const result = await request.user!.save()
    return { message: 'alerts.successSaving', result: result }
  }
}

@Route('users')
@Security('cookieAuth', ['user', 'approve/travel'])
@Security('cookieAuth', ['user', 'examine/travel'])
@Security('cookieAuth', ['user', 'examine/expenseReport'])
@Security('cookieAuth', ['user', 'examine/healthCareCost'])
@Security('cookieAuth', ['user', 'confirm/healthCareCost'])
@Security('cookieAuth', ['user', 'admin'])
export class UsersController extends Controller {
  @Get()
  public async getUsers(@Queries() query: GetterQuery<IUser>) {
    return await this.getter(User, {
      query,
      projection: { name: 1 },
      filter: { 'fk.magiclogin': { $ne: tokenAdminUser.fk.magiclogin } }
    })
  }
}

function sendNewMagicloginMail(user: IUser) {
  sendMail(
    [user],
    i18n.t('mail.newMagiclogin.subject', { lng: user.settings.language }),
    i18n.t('mail.newMagiclogin.paragraph', { lng: user.settings.language }),
    { text: i18n.t('mail.newMagiclogin.buttonText', { lng: user.settings.language }), link: process.env.VITE_FRONTEND_URL },
    i18n.t('mail.newMagiclogin.lastParagraph', { lng: user.settings.language })
  )
}

interface SetterBodyUser extends SetterBody<IUser> {
  loseAccessAt: null | Date | undefined
}

@Route('admin/user')
@Security('cookieAuth', ['admin'])
export class UserAdminController extends Controller {
  @Get()
  public async getUser(@Queries() query: GetterQuery<IUser>) {
    return await this.getter(User, {
      query,
      projection: { vehicleRegistration: 0 },
      filter: { 'fk.magiclogin': { $ne: tokenAdminUser.fk.magiclogin } }
    })
  }

  @Post()
  public async postUser(@Body() requestBody: SetterBodyUser) {
    let cb: ((data: IUser) => any) | undefined = undefined

    if (!requestBody._id && requestBody.fk && requestBody.fk.magiclogin) {
      cb = sendNewMagicloginMail
    }
    return await this.setter(User, { requestBody: requestBody, allowNew: true, cb })
  }

  @Post('bulk')
  public async postManyProjects(@Body() requestBody: SetterBodyUser[]) {
    const newMagicloginUsers: number[] = []
    for (let i = 0; i < requestBody.length; i++) {
      if (!requestBody[i]._id && requestBody[i].fk && requestBody[i].fk!.magiclogin) {
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
  public async deleteUser(@Query() _id: _id) {
    return await this.deleter(User, {
      _id,
      referenceChecks: [
        { model: Travel, paths: ['owner', 'editor', 'comments.author'], conditions: { historic: false } },
        { model: ExpenseReport, paths: ['owner', 'editor', 'comments.author'], conditions: { historic: false } },
        { model: HealthCareCost, paths: ['owner', 'editor', 'comments.author'], conditions: { historic: false } }
      ]
    })
  }

  @Post('merge')
  public async mergeUsers(@Body() requestBody: { userId: IdDocument; userIdToOverwrite: IdDocument }, @Query() delOverwritten?: boolean) {
    if (idDocumentToId(requestBody.userId) === idDocumentToId(requestBody.userIdToOverwrite)) {
      throw new NotAllowedError(`Users are the same.`)
    }
    const user = await User.findOne({ _id: idDocumentToId(requestBody.userId) })
    if (user) {
      const userIdToOverwrite = new Types.ObjectId(idDocumentToId(requestBody.userIdToOverwrite))
      const userToOverwrite = await User.findOne({ _id: userIdToOverwrite }).lean()

      let deleteResult: DeleteResult | null = null
      if (delOverwritten) {
        deleteResult = await User.deleteOne({ _id: userIdToOverwrite })
      }

      let mergedUser = user.toObject()
      if (userToOverwrite) {
        mergedUser = await user.merge(userToOverwrite, Boolean(delOverwritten))
      }

      const replacedReferences = await user.replaceReferences(userIdToOverwrite)

      return { result: { mergedUser, replacedReferences, deleteResult }, message: 'alerts.successSaving' }
    } else {
      throw new NotFoundError(`No user for _id: ${idDocumentToId(requestBody.userId)} found.`)
    }
  }
  @Get('form')
  public async getUserForm() {
    return { data: mongooseSchemaToVueformSchema(userSchema.obj, locales) }
  }
}
