import { Request as ExRequest, Response as ExResponse, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import { Body, Controller, Delete, Get, Middlewares, Post, Query, Request, Response, Route, Security, SuccessResponse, Tags } from 'tsoa'
import { escapeRegExp } from '../../common/scripts.js'
import { tokenAdminUser } from '../../common/types.js'
import { getLdapauthStrategy } from '../authStrategies/ldapauth.js'
import magiclogin from '../authStrategies/magiclogin.js'
import { getMicrosoftStrategy } from '../authStrategies/microsoft.js'
import { getOidcStrategy } from '../authStrategies/oidc.js'
import { getDisplaySettings } from '../db.js'
import User from '../models/user.js'
import { NotAllowedError, NotImplementedError } from './error.js'

const disabledMessage = 'This Authentication Method has been disabled by display settings.'

const NotImplementedMiddleware = (req: ExRequest, res: ExResponse, next: NextFunction) => {
  throw new NotImplementedError(disabledMessage)
}

const ldapauthHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.ldapauth) {
    passport.authenticate(await getLdapauthStrategy(), { session: true })(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const microsoftHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.microsoft) {
    if (req.query.redirect && typeof req.query.redirect === 'string') {
      req.session.redirect = req.query.redirect
    }
    passport.authenticate(await getMicrosoftStrategy())(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const microsoftCallbackHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.microsoft) {
    const successRedirect = req.session.redirect ? process.env.VITE_FRONTEND_URL + req.session.redirect : process.env.VITE_FRONTEND_URL
    passport.authenticate(await getMicrosoftStrategy(), { successRedirect })(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const magicloginHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.magiclogin) {
    const user = await User.findOne({ 'fk.magiclogin': { $regex: new RegExp(`^${escapeRegExp(req.body.destination)}$`, 'i') } })
    if (!user || !(await user.isActive())) {
      throw new NotAllowedError(`No magiclogin user found for e-mail: ${req.body.destination}`)
    }
    magiclogin.send(req, res)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const oidcHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.oidc) {
    if (req.query.redirect && typeof req.query.redirect === 'string') {
      req.session.redirect = req.query.redirect
    }
    passport.authenticate(await getOidcStrategy())(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

const oidcCallbackHandler = async (req: ExRequest, res: ExResponse, next: NextFunction) => {
  if ((await getDisplaySettings()).auth.oidc) {
    const successRedirect = req.session.redirect ? process.env.VITE_FRONTEND_URL + req.session.redirect : process.env.VITE_FRONTEND_URL
    passport.authenticate(await getOidcStrategy(), { successRedirect })(req, res, next)
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
      failureRedirect: `${process.env.VITE_FRONTEND_URL}/login${redirect ? `?redirect=${redirect}` : ''}`
    })(req, res, next)
  } else {
    NotImplementedMiddleware(req, res, next)
  }
}

@Tags('Auth')
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
  public microsoftCallback() {}

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

  /**
   * @summary Redirecting to OIDC login
   */
  @Get('oidc')
  @Middlewares(oidcHandler)
  @SuccessResponse(302, 'Redirecting to OIDC Provider')
  public oidc(@Query() redirect?: string) {}

  /**
   * @summary OIDC login callback endpoint
   */
  @Get('oidc/callback')
  @Middlewares(oidcCallbackHandler)
  @SuccessResponse(302, 'Redirecting to Frontend')
  public oidcCallback() {}

  private redirectToFrontend(path?: string) {
    let redirect = ''
    if (path?.startsWith('/')) {
      redirect = path
    }
    this.setHeader('Location', process.env.VITE_FRONTEND_URL + redirect)
    this.setStatus(302)
  }
}

@Tags('Auth')
@Security('cookieAuth')
@Security('httpBearer')
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
