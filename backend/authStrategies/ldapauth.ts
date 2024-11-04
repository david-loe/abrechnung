import LdapStrategy from 'passport-ldapauth'
import { ldapauthSettings } from '../../common/types.js'
import { getConnectionSettings } from '../db.js'
import { mapLdapauthConfig } from '../settingsValidator.js'
import { findOrCreateUser } from './index.js'

export async function getLdapauthStrategy() {
  const connectionSettings = await getConnectionSettings()
  if (connectionSettings.auth.ldapauth) {
    const config: ldapauthSettings = connectionSettings.auth.ldapauth
    return new LdapStrategy(
      {
        server: mapLdapauthConfig(config)
      },
      async function (ldapUser: any, cb: (error: any, user?: any) => void) {
        let email: string | string[] = ldapUser[config.mailAttribute]

        findOrCreateUser(
          { ldapauth: ldapUser[config.uidAttribute] },
          {
            email: Array.isArray(email) ? (email.length > 0 ? email[0] : '') : email,
            name: { familyName: ldapUser[config.familyNameAttribute], givenName: ldapUser[config.givenNameAttribute] }
          },
          cb
        )
      }
    )
  } else {
    throw new Error('LDAP not configured in Connection Settings')
  }
}
