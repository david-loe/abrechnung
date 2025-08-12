import { microsoftSettings } from 'abrechnung-common/types.js'
import { Strategy as MicrosoftStrategy } from 'passport-microsoft'
import { getConnectionSettings } from '../db.js'
import ENV from '../env.js'
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
  if (!connectionSettings.auth.microsoft) {
    throw new Error('Microsoft not configured in Connection Settings')
  }
  const config: microsoftSettings = connectionSettings.auth.microsoft
  return new MicrosoftStrategy(
    {
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackURL: `${ENV.VITE_BACKEND_URL}/auth/microsoft/callback`,
      tenant: config.tenant,
      scope: ['user.read']
    },
    async (_accessToken: string, _refreshToken: string, profile: msProfile, verified: (error: unknown, user?: Express.User) => void) => {
      const nameSplit = displayNameSplit(profile._json.displayName)
      await findOrCreateUser(
        { microsoft: profile._json.id },
        {
          email: profile._json.mail,
          name: { familyName: profile._json.surname || nameSplit.familyName, givenName: profile._json.givenName || nameSplit.givenName }
        },
        verified
      )
    }
  )
}
