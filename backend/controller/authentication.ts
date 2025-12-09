import { Access } from 'abrechnung-common/types.js'
import { Request } from 'express'
import passport, { AuthenticateCallback } from 'passport'
import httpBearerStrategy from '../authStrategies/http-bearer.js'
import usageTokenStrategy from '../authStrategies/usage-token.js'
import { AuthorizationError } from './error.js'

export async function expressAuthentication(req: Request, securityName: string, scopes?: string[]): Promise<Express.User> {
  if (securityName === 'cookieAuth') {
    if (req.isAuthenticated() && (await isUserAllowedToAccess(req.user, scopes as Access[] | undefined))) {
      return req.user
    }
  } else if (securityName === 'httpBearer') {
    return BearerAuthentication(req, httpBearerStrategy, scopes)
  } else if (securityName === 'usageToken') {
    return BearerAuthentication(req, usageTokenStrategy, scopes)
  }
  throw new AuthorizationError()
}

function BearerAuthentication(req: Request, strategy: passport.Strategy, scopes?: string[]) {
  return new Promise<Express.User>((resolve, reject) => {
    const authenticateCallback: AuthenticateCallback = async (err, user, _info, _status) => {
      if (err || !user || !(await isUserAllowedToAccess(user as Express.User, scopes as Access[] | undefined))) {
        reject(new AuthorizationError())
      } else {
        resolve(user)
      }
    }
    passport.authenticate(strategy, { session: false }, authenticateCallback)(req)
  })
}

export async function isUserAllowedToAccess(user: Express.User, scopes?: Access[], condition: 'all' | 'one' = 'all') {
  if (!(await user.isActive())) {
    return false
  }
  if (!scopes) {
    return true
  }
  if (condition === 'all') {
    for (const access of scopes) {
      if (!user.access[access]) {
        return false
      }
    }
    return true
  } else if (condition === 'one') {
    for (const access of scopes) {
      if (user.access[access]) {
        return true
      }
    }
    return false
  }
}
