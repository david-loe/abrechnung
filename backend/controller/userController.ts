import { Route, Get, Tags, Security, Queries, Request, Post, Body, Delete, Middlewares, Consumes, BodyProp, Query } from 'tsoa'
import { Controller, DeleterQuery, GetterOptions, GetterQuery } from './controller.js'
import multer from 'multer'
import User from '../models/user.js'
import Token from '../models/token.js'
import { User as IUser, Token as IToken } from '../../common/types.js'
import { Request as ExRequest } from 'express'
import { sendMail } from '../mail/mail.js'
import i18n from '../i18n.js'
import { documentFileHandler } from '../helper.js'
import { File, UserPost, UserSettingsPost, _id } from './types.js'

const fileHandler = multer({ limits: { fileSize: 16000000 } })

@Tags('Admin', 'User')
@Route('api/admin/user')
@Security('cookieAuth', ['admin'])
export class UserAdminController extends Controller {
  @Get()
  public async getUser(@Queries() query: GetterQuery<IUser>) {
    const options: GetterOptions<IUser> = {}
    return await this.getter(User, Object.assign({}, query, options))
  }

  @Post()
  public async postUser(@Body() requestBody: UserPost) {
    var cb: ((data: IUser) => any) | undefined = undefined
    if (!requestBody._id && requestBody.fk && requestBody.fk.magiclogin) {
      cb = (user: IUser) => {
        sendMail(
          [user],
          i18n.t('mail.newMagiclogin.subject', { lng: user.settings.language }),
          i18n.t('mail.newMagiclogin.paragraph', { lng: user.settings.language }),
          { text: i18n.t('mail.newMagiclogin.buttonText', { lng: user.settings.language }), link: process.env.VITE_FRONTEND_URL },
          i18n.t('mail.newMagiclogin.lastParagraph', { lng: user.settings.language })
        )
      }
    }
    return await this.setter(User, { requestBody: requestBody as unknown as IUser, allowNew: true, cb })
  }

  @Delete()
  public async deleteUser(@Query() _id: _id) {
    return await this.deleter(User, { _id })
  }
}

@Tags('User')
@Route('api/user')
@Security('cookieAuth', ['user'])
export class UserController extends Controller {
  @Get()
  public getMe(@Request() request: ExRequest) {
    return { data: request.user! as IUser }
  }

  @Tags('Upload')
  @Get('token')
  public getToken(@Request() request: ExRequest) {
    return { data: request.user!.token }
  }

  @Tags('Upload')
  @Delete('token')
  public async deleteToken(@Request() request: ExRequest) {
    request.user!.token = undefined
    await request.user!.save()
  }

  @Tags('Upload')
  @Post('token')
  public async postToken(@Request() request: ExRequest) {
    const token = (await new Token().save()).toObject()
    request.user!.token = token as unknown as any
    await request.user!.save()
    return { message: 'alerts.successSaving', result: token }
  }

  @Post('settings')
  public async postSettings(@Body() requestBody: Partial<UserSettingsPost>, @Request() request: ExRequest) {
    Object.assign(request.user!.settings, requestBody)
    request.user!.markModified('settings')
    const result = await request.user!.save()
    return { message: 'alerts.successSaving', result: result.settings }
  }

  @Post('vehicleRegistration')
  @Middlewares(fileHandler.any(), documentFileHandler(['vehicleRegistration'], true))
  @Consumes('multipart/form-data')
  public async postVehicleRegistration(@BodyProp() vehicleRegistration: File[], @Request() request: ExRequest) {
    request.user!.vehicleRegistration = vehicleRegistration as unknown as any
    request.user!.markModified('vehicleRegistration')
    const result = await request.user!.save()
    return { message: 'alerts.successSaving', result: result }
  }
}
