// authStrategies/oidc.ts
import { Request } from 'express'
import * as openidClient from 'openid-client'
import { Strategy as OidcStrategy } from 'openid-client/passport'
import passport from 'passport'
import { getConnectionSettings } from '../db.js'
import ENV from '../env.js'
import { displayNameSplit, findOrCreateUser } from './index.js'

const scope = 'openid email profile'

const callbackPath = '/auth/oidc/callback'

export class CustomStrategy extends OidcStrategy {
  authenticate<TOptions extends passport.AuthenticateOptions = passport.AuthenticateOptions>(
    this: passport.StrategyCreated<OidcStrategy, OidcStrategy & passport.StrategyCreatedStatic>,
    req: Request,
    options: TOptions
  ): void {
    //check for callback url rather than param count
    if ((req.originalUrl ?? req.url).startsWith(callbackPath)) {
      // rewrite URL so when behind proxy no error is thrown
      const url = new URL(`${ENV.VITE_BACKEND_URL}${req.originalUrl ?? req.url}`)
      // fix error from empty state search param david-loe/abrechnung#140
      const params = new URLSearchParams(url.search)
      if (params.has('state') && !params.get('state')) {
        params.delete('state')
        url.search = params.toString()
      }
      // biome-ignore lint/suspicious/noExplicitAny: need access to prototype method
      ;(OidcStrategy as any).prototype.authorizationCodeGrant.call(this, req, url, options)
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: need access to prototype method
      ;(OidcStrategy as any).prototype.authorizationRequest.call(this, req, options)
    }
  }
}

export async function getOidcStrategy() {
  const connectionSettings = await getConnectionSettings()

  if (!connectionSettings.auth.oidc) {
    throw new Error('OIDC not configured in Connection Settings')
  }
  const { server, clientId, clientSecret } = connectionSettings.auth.oidc

  const config = await openidClient.discovery(new URL(server), clientId, clientSecret)

  return new CustomStrategy({ callbackURL: `${ENV.VITE_BACKEND_URL}${callbackPath}`, config, scope }, async (tokens, verified) => {
    try {
      const claims = tokens.claims()
      if (claims?.email && claims.name) {
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
  })
}
