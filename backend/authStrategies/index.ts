import { HydratedDocument } from 'mongoose'
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
