import { Request } from 'express'
import { Access } from '../../common/types.js'
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
    } else {
      throw new AuthorizationError()
    }
  }
}
