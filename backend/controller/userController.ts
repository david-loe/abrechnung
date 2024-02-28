import { Route, Get, Tags, Security, Queries, Request, Post, Body, Delete, Middlewares, Consumes, BodyProp } from 'tsoa'
import { Controller, GetterOptions, GetterQuery, SetterBody } from './controller.js'
import multer from 'multer'
import User from '../models/user.js'
import Token from '../models/token.js'
import { User as IUser, Token as IToken } from '../../common/types.js'
import { Request as ExRequest } from 'express'
import { sendMail } from '../mail/mail.js'
import i18n from '../i18n.js'
import { documentFileHandler } from '../helper.js'
import { File } from './types.js'

const fileHandler = multer({ limits: { fileSize: 16000000 } })

@Tags('Admin', 'User')
@Route('admin')
@Security('cookieAuth', ['admin'])
export class UserAdminController extends Controller {
  @Get('user')
  public getUser(@Queries() query: GetterQuery<IUser>) {
    const options: GetterOptions<IUser> = {}
    return this.getter(User, Object.assign({}, query, options))
  }

  @Post('user')
  public postUser(@Body() requestBody: SetterBody<IUser>) {
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
    this.setter(User, { requestBody, allowNew: true, cb })
  }
}

@Tags('User')
@Route('user')
@Security('cookieAuth', ['user'])
export class UserController extends Controller {
  @Get()
  public getMe(@Request() request: ExRequest) {
    return request.user! as IUser
  }

  @Get('token')
  public getToken(@Request() request: ExRequest) {
    return request.user!.token as IToken
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
    return { message: i18n.t('alerts.successSaving'), result: token }
  }

  @Post('settings')
  public async postSettings(@Body() requestBody: Partial<IUser['settings']>, @Request() request: ExRequest) {
    Object.assign(request.user!.settings, requestBody)
    request.user!.markModified('settings')
    const result = await request.user!.save()
    return { message: i18n.t('alerts.successSaving'), result: result.settings }
  }

  @Post('vehicleRegistration')
  @Middlewares(fileHandler.any(), documentFileHandler(['vehicleRegistration'], true))
  @Consumes('multipart/form-data')
  public async postVehicleRegistration(@BodyProp() vehicleRegistration: File[], @Request() request: ExRequest) {
    request.user!.vehicleRegistration = vehicleRegistration as unknown as any
    request.user!.markModified('vehicleRegistration')
    const result = await request.user!.save()
    return { message: i18n.t('alerts.successSaving'), result: result }
  }
}
