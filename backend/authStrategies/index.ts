import { HydratedDocument } from 'mongoose'
import passport from 'passport'
import { Contact, User as IUser } from '../../common/types.js'
import User from '../models/user.js'

export interface NewUser extends Contact {
  fk?: IUser['fk']
  access?: { user: IUser['access']['user'] }
}

export function addAdminIfNone(user: HydratedDocument<IUser>) {
  User.exists({ 'access.admin': true }).then((doc) => {
    if (doc === null) {
      user.access.admin = true
      user.markModified('access')
      user.save()
    }
  })
}

export abstract class AuthenticationStrategy<Strategy extends passport.Strategy, Options extends any> {
  strategy: Strategy | undefined

  getStrategy() {
    if (!this.strategy) {
      throw new Error('ldapauth Strategy is not configured')
    }
    console.log('get ' + this.strategy.name)
    return this.strategy
  }

  abstract configureStrategy(config: Options): void
}
