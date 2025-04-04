import { Request } from 'express'
import passport, { AuthenticateCallback } from 'passport'
import { Access } from '../../common/types.js'
import httpBearerStrategy from '../authStrategies/http-bearer.js'
import { AuthorizationError } from './error.js'

export async function expressAuthentication(req: Request, securityName: string, scopes?: string[]): Promise<any> {
  if (securityName === 'cookieAuth') {
    if (req.isAuthenticated() && (await isUserAllowedToAccess(req.user, scopes as Access[] | undefined))) {
      return req.user
    }
  } else if (securityName === 'httpBearer') {
    return new Promise((resolve, reject) => {
      const authenticateCallback: AuthenticateCallback = async (err, user, info, status) => {
        if (err || !user || !(await isUserAllowedToAccess(user as Express.User, scopes as Access[] | undefined))) {
          reject(new AuthorizationError())
        }
        resolve(user)
      }
      passport.authenticate(httpBearerStrategy, { session: false }, authenticateCallback)(req)
    })
  }
  throw new AuthorizationError()
}

export async function isUserAllowedToAccess(user: Express.User, scopes?: Access[]) {
  if (await user.isActive()) {
    if (scopes) {
      for (const access of scopes) {
        if (!user.access[access]) {
          return false
        }
      }
    }
  }
  return true
}
