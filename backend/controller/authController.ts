import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Body, Controller, Delete, Get, Middlewares, Post, Query, Request, Response, Route, Security, SuccessResponse } from 'tsoa'
import { Base64, escapeRegExp } from '../../common/scripts.js'
import { tokenAdminUser } from '../../common/types.js'
import ldapauth from '../authStrategies/ldapauth.js'
import magiclogin from '../authStrategies/magiclogin.js'
import microsoft from '../authStrategies/microsoft.js'
import { getDisplaySettings } from '../helper.js'
import User from '../models/user.js'
import { NotAllowedError, NotImplementedError } from './error.js'

const disabledMessage = 'This Authentication Method has been disabled by display settings.'
const useMagicLogin = process.env.VITE_AUTH_USE_MAGIC_LOGIN.toLowerCase() === 'true'

const NotImplementedMiddleware = (req: ExRequest, res: ExResponse, next: NextFunction) => {
  throw new NotImplementedError(disabledMessage)
}

const ldapauthHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.ldapauth) {
    passport.authenticate(ldapauth.getStrategy(), { session: true })(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const microsoftHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.microsoft) {
    const redirect = req.query.redirect
    const state = req.query.redirect ? Base64.encode(JSON.stringify({ redirect })) : undefined
    passport.authenticate(microsoft.getStrategy(), { state: state })(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const microsoftCallbackHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.microsoft) {
    passport.authenticate(microsoft.getStrategy())(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const magicloginHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.magiclogin) {
    var user = await User.findOne({ 'fk.magiclogin': { $regex: new RegExp('^' + escapeRegExp(req.body.destination) + '$', 'i') } })
    if (user && (await user.isActive())) {
      magiclogin.send(req, res)
    } else {
      throw new NotAllowedError('No magiclogin user found for e-mail: ' + req.body.destination)
    }
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const magicloginCallbackHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  let redirect: any
  let tokenAdmin = false
  if (req.query.token) {
    const token = jwt.decode(req.query.token as string) as jwt.JwtPayload
    const redirectPath = token.redirect
    tokenAdmin = token.destination === tokenAdminUser.fk.magiclogin
    if (redirectPath && typeof redirectPath === 'string' && redirectPath.startsWith('/')) {
      redirect = redirectPath
    }
  }
  if ((await getDisplaySettings()).auth.magiclogin || tokenAdmin) {
    passport.authenticate(magiclogin, {
      failureRedirect: process.env.VITE_FRONTEND_URL + '/login' + (redirect ? '?redirect=' + redirect : '')
    })(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

@Route('auth')
@Response(501, disabledMessage)
export class AuthController extends Controller {
  /**
   * Provides the authentication cookie.
   * @summary Login using LDAP
   */
  @Post('ldapauth')
  @Middlewares(ldapauthHandler)
  public ldapauth(@Body() requestBody: { username: string; password: string }) {}

  /**
   * @summary Redirecting to Microsoft login
   */
  @Get('microsoft')
  @Middlewares(microsoftHandler)
  @SuccessResponse(302, 'Redirecting to Microsoft')
  public microsoft(@Query() redirect?: string) {}

  /**
   * Provides the authentication cookie.
   * @summary Microsoft login endpoint
   */
  @Get('microsoft/callback')
  @Middlewares(microsoftCallbackHandler)
  @SuccessResponse(302, 'Redirecting to Frontend')
  public microsoftCallback(@Query() state?: string) {
    var redirect: string | undefined
    if (state) {
      try {
        redirect = JSON.parse(Base64.decode(state)).redirect
      } catch {}
    }
    this.redirectToFrontend(redirect)
  }

  /**
   * Send a magiclogin email to the destination email address.
   * @summary Send login email
   */
  @Post('magiclogin')
  @Middlewares(magicloginHandler)
  @SuccessResponse(200)
  public magiclogin(@Body() requestBody: { destination: string; redirect?: string }) {}

  /**
   * Provides the authentication cookie.
   * @summary Email login endpoint
   */
  @Get('magiclogin/callback')
  @Middlewares(magicloginCallbackHandler)
  @SuccessResponse(302, 'Redirecting to Frontend')
  public magicloginCallback(@Query() token: string, @Request() req: ExRequest) {
    this.redirectToFrontend(req.authInfo?.redirect)
  }

  private redirectToFrontend(path?: string) {
    var redirect = ''
    if (path && path.startsWith('/')) {
      redirect = path
    }
    this.setHeader('Location', process.env.VITE_FRONTEND_URL + redirect)
    this.setStatus(302)
  }
}

@Security('cookieAuth')
@Route('auth')
export class logoutController extends Controller {
  /**
   * Logout and delete session
   * @summary Logout
   */
  @Delete('logout')
  public logout(@Request() request: ExRequest) {
    request.logout((err) => {
      if (err) {
        throw new Error(err)
      }
    })
  }
  /**
   * Empty method
   * @summary Check if request is authenticated
   */
  @Get('authenticated')
  public authenticated(): void {}
}
