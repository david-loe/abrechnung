import { Request } from 'express'
import passport, { AuthenticateCallback } from 'passport'
import { Access } from '../../common/types.js'
import httpBearerStrategy from '../authStrategies/http-bearer.js'
import { AuthorizationError } from './error.js'

export async function expressAuthentication(req: Request, securityName: string, scopes?: string[]): Promise<any> {
  if (securityName === 'cookieAuth') {
    if (req.isAuthenticated() && (await req.user.isActive())) {
      if (scopes) {
        for (const access of scopes as Access[]) {
          if (!req.user!.access[access]) {
            throw new AuthorizationError()
          }
        }
      }
      return req.user!
    }
  } else if (securityName === 'httpBearer') {
    return new Promise((resolve) => {
      const authenticateCallback: AuthenticateCallback = (err, user, info, status) => {
        if (err || !user) throw new AuthorizationError()
        resolve(user)
      }
      passport.authenticate(httpBearerStrategy, { session: false }, authenticateCallback)(req)
    })
  }
  throw new AuthorizationError()
}
