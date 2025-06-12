import { HydratedDocument } from 'mongoose'
import { Contact, User as IUser, tokenAdminUser } from '../../common/types.js'
import { getSettings } from '../db.js'
import User from '../models/user.js'

export interface NewUser extends Contact {
  fk?: IUser['fk']
  access?: IUser['access']
}

export function addAdminIfNone(user: HydratedDocument<IUser>) {
  User.exists({ 'access.admin': true, 'fk.magiclogin': { $ne: tokenAdminUser.fk.magiclogin } }).then((doc) => {
    if (doc === null) {
      user.access.admin = true
      user.markModified('access')
      user.save()
    }
  })
}

export async function findOrCreateUser(filter: IUser['fk'], userData: Omit<NewUser, 'fk'>, cb: (error: any, user?: Express.User) => void) {
  const searchFilter = {} as any
  // find User with fk, regardless of other fks
  for (const key in filter) {
    searchFilter[`fk.${key}`] = filter[key as keyof IUser['fk']]
  }
  let user = await User.findOne(searchFilter)
  const email = userData.email
  if (!user && email) {
    user = await User.findOne({ email: email })
  }
  const newUser: NewUser = { fk: filter, email: email, name: userData.name, access: (await getSettings()).defaultAccess }
  if (!user) {
    user = new User(newUser)
  } else {
    delete newUser.access
    Object.assign(user.fk, newUser.fk)
    delete newUser.fk
    Object.assign(user, newUser)
  }
  try {
    await user.save()
    addAdminIfNone(user)
    cb(null, user)
  } catch (error) {
    cb(error)
  }
}

export function displayNameSplit(displayName: string) {
  const isComma = displayName.indexOf(', ') !== -1
  const splitStr = isComma ? ', ' : ' '
  const split = displayName.split(splitStr)
  const one = split.shift() as string
  const two = split.join(' ') || ' '
  return { givenName: isComma ? two : one, familyName: isComma ? one : two }
}
