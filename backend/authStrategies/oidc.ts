// authStrategies/oidc.ts
import * as openidClient from 'openid-client'
import { Strategy as OidcStrategy } from 'openid-client/passport'
import { getConnectionSettings } from '../db.js'
import { displayNameSplit, findOrCreateUser } from './index.js'
import { Request } from 'express'
import passport from 'passport'

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
      ;(OidcStrategy as any).prototype.authorizationCodeGrant.call(
        this,
        req,
        new URL(`${process.env.VITE_BACKEND_URL}${req.originalUrl ?? req.url}`), // rewrite URL so when behind proxy no error is thrown
        options
      )
    } else {
      ;(OidcStrategy as any).prototype.authorizationRequest.call(this, req, options)
    }
  }
}

export async function getOidcStrategy() {
  const connectionSettings = await getConnectionSettings()

  if (connectionSettings.auth.oidc) {
    const { server, clientId, clientSecret } = connectionSettings.auth.oidc

    const config = await openidClient.discovery(new URL(server), clientId, clientSecret)

    return new CustomStrategy(
      {
        callbackURL: `${process.env.VITE_BACKEND_URL}${callbackPath}`,
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
    throw new Error('OIDC not configured in Connection Settings')
  }
}
