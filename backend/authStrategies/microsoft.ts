import { Strategy as MicrosoftStrategy } from 'passport-microsoft'
import { microsoftSettings } from '../../common/types.js'
import { getConnectionSettings } from '../db.js'
import { displayNameSplit, findOrCreateUser } from './index.js'

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

export async function getMicrosoftStrategy() {
  const connectionSettings = await getConnectionSettings()
  if (connectionSettings.auth.microsoft) {
    const config: microsoftSettings = connectionSettings.auth.microsoft
    return new MicrosoftStrategy(
      {
        clientID: config.clientId,
        clientSecret: config.clientSecret,
        callbackURL: process.env.VITE_BACKEND_URL + '/auth/microsoft/callback',
        tenant: config.tenant,
        scope: ['user.read']
      },
      async function (accessToken: string, refreshToken: string, profile: msProfile, verified: (error: any, user?: Express.User) => void) {
        let nameSplit = displayNameSplit(profile._json.displayName)
        await findOrCreateUser(
          { microsoft: profile._json.id },
          {
            email: profile._json.mail,
            name: {
              familyName: profile._json.surname || nameSplit.familyName, // first part of displayNameSplit
              givenName: profile._json.givenName || nameSplit.givenName // rest of displayNameSplit
            }
          },
          verified
        )
      }
    )
  } else {
    throw new Error('Microsoft not configured in Connection Settings')
  }
}
