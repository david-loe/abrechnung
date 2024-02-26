import { Route, Get, Tags, Security, Queries, Request, Post, Body } from 'tsoa'
import { Controller, GetterOptions, GetterQuery, SetterBody } from './controller.js'
import User from '../models/user.js'
import { User as IUser, Token } from '../../common/types.js'
import { Request as ExRequest } from 'express'
import { sendMail } from '../mail/mail.js'
import i18n from '../i18n.js'

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
    return request.user!.token as Token
  }
}
