// authStrategies/oidc.ts
import * as openidClient from 'openid-client'
import { Strategy as OidcStrategy } from 'openid-client/passport'
import { getConnectionSettings } from '../db.js'
import { displayNameSplit, findOrCreateUser } from './index.js'

const scope = 'openid email profile'

export async function getOidcStrategy() {
  const connectionSettings = await getConnectionSettings()

  if (connectionSettings.auth.oidc) {
    const { server, clientId, clientSecret } = connectionSettings.auth.oidc

    const config = await openidClient.discovery(new URL(server), clientId, clientSecret)

    return new OidcStrategy(
      {
        callbackURL: `${process.env.VITE_BACKEND_URL}/auth/oidc/callback`,
        config,
        scope
      },
      async (tokens, verified) => {
        try {
          const claims = tokens.claims()
          if (claims && claims.email && claims.name) {
            const nameSplit = displayNameSplit(claims.name as string)
            await findOrCreateUser(
              { oidc: claims.sub },
              {
                email: claims.email as string,
                name: {
                  familyName: (claims.family_name as string) || nameSplit.familyName,
                  givenName: (claims.given_name as string) || nameSplit.givenName
                }
              },
              verified
            )
          }
        } catch (error) {
          verified(error)
        }
      }
    )
  } else {
    throw new Error('OIDC nicht in den Connection Settings konfiguriert.')
  }
}
