// authStrategies/oidc.ts
import * as openidClient from 'openid-client'
import { Strategy as OidcStrategy } from 'openid-client/passport'
import { getConnectionSettings } from '../db.js'
import { findOrCreateUser } from './index.js'

export const scope = 'openid email profile'

export async function getOidcStrategy() {
  const connectionSettings = await getConnectionSettings()
  if (connectionSettings.auth.oidc) {
    const { server, clientId, clientSecret } = connectionSettings.auth.oidc

    // Discovery des OIDC Providers anhand der issuerUrl
    const config = await openidClient.discovery(new URL(server), clientId, clientSecret)

    // Erstelle die Strategy unter Verwendung des erstellten Clients.
    return new OidcStrategy(
      {
        config,
        scope
      },
      async (tokens, verified) => {
        try {
          // Extrahiere Claims aus den tokens
          const claims = tokens.claims()
          if (claims) {
            console.log(claims)
            await findOrCreateUser(
              { oidc: claims.sub },
              {
                //@ts-ignore
                email: claims.email,
                name: {
                  //@ts-ignore
                  familyName: claims.family_name, //@ts-ignore
                  givenName: claims.given_name
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
