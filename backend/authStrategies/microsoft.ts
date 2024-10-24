import { Strategy as MicrosoftStrategy } from 'passport-microsoft'
import { microsoftSettings } from '../../common/types.js'
import User from '../models/user.js'
import { AuthenticationStrategy, NewUser, addAdminIfNone } from './index.js'

interface msProfile {
  provider: 'microsoft'
  name: { familyName: string; givenName: string } | { familyName: null; givenName: null }
  id: string
  displayName: string
  emails: { type: string; value: string }[]
  _raw: string
  _json: {
    '@odata.context': string
    businessPhones: string[]
    displayName: string
    givenName: string | null
    jobTitle: string | null
    mail: string
    mobilePhone: string | null
    officeLocation: string | null
    preferredLanguage: string | null
    surname: string | null
    userPrincipalName: string
    id: string
  }
}

class Microsoft extends AuthenticationStrategy<MicrosoftStrategy, microsoftSettings> {
  configureStrategy(config: microsoftSettings) {
    this.strategy = new MicrosoftStrategy(
      {
        clientID: config.clientId,
        clientSecret: config.clientSecret,
        callbackURL: process.env.VITE_BACKEND_URL + '/auth/microsoft/callback',
        tenant: config.tenant,
        scope: ['user.read']
      },
      async function (accessToken: string, refreshToken: string, profile: msProfile, verified: (error: any, user?: Express.User) => void) {
        var user = await User.findOne({ 'fk.microsoft': profile._json.id })
        var email = profile._json.mail
        if (!user && email) {
          user = await User.findOne({ email: email })
        }
        let displayNameSplit = profile._json.displayName.split(' ')
        const newUser: NewUser = {
          fk: { microsoft: profile._json.id },
          email: email,
          name: {
            familyName: profile._json.surname || (displayNameSplit.shift() as string), // first part of displayNameSplit
            givenName: profile._json.givenName || (displayNameSplit.length > 1 ? displayNameSplit.join(' ') : ' ') // rest of displayNameSplit
          }
        }
        if (!user) {
          user = new User(newUser)
        } else {
          Object.assign(user.fk, newUser.fk)
          delete newUser.fk
          Object.assign(user, newUser)
        }
        try {
          await user.save()
          verified(null, user)
          addAdminIfNone(user)
        } catch (error) {
          verified(error)
        }
      }
    )
  }
}

export default new Microsoft()
