import { ldapauthSettings } from 'abrechnung-common/types.js'
import LdapStrategy from 'passport-ldapauth'
import { getConnectionSettings } from '../db.js'
import { mapLdapauthConfig } from '../settingsValidator.js'
import { findOrCreateUser } from './index.js'

export async function getLdapauthStrategy() {
  const connectionSettings = await getConnectionSettings()
  if (!connectionSettings.auth.ldapauth) {
    throw new Error('LDAP not configured in Connection Settings')
  }
  const config: ldapauthSettings = connectionSettings.auth.ldapauth
  return new LdapStrategy(
    { server: mapLdapauthConfig(config) },
    async (ldapUser: Record<string, unknown>, cb: (error: unknown, user?: Express.User) => void) => {
      const email = ldapUser[config.mailAttribute] as string | string[]

      findOrCreateUser(
        { ldapauth: ldapUser[config.uidAttribute] as string },
        {
          email: Array.isArray(email) ? (email.length > 0 ? email[0] : '') : email,
          name: { familyName: ldapUser[config.familyNameAttribute] as string, givenName: ldapUser[config.givenNameAttribute] as string }
        },
        cb
      )
    }
  )
}
