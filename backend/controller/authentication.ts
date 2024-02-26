import { Request } from 'express'
import { Access } from '../../common/types.js'
import { UserDoc } from '../models/user.js'

export async function expressAuthentication(req: Request, securityName: string, scopes?: string[]): Promise<any> {
  if (securityName === 'cookieAuth') {
    if (req.isAuthenticated() && (await (req.user as UserDoc).isActive())) {
      if (scopes) {
        for (const access of scopes as Access[]) {
          if (!req.user!.access[access]) {
            throw new Error('alerts.request.unauthorized')
          }
        }
      } else if (!req.user!.access['user']) {
        throw new Error('alerts.request.unauthorized')
      }
      return req.user!
    } else {
      throw new Error('alerts.request.unauthorized')
    }
  }
}
