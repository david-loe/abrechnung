import {
  AuthInfo,
  buildOAuthProtectedResourceMetadata,
  OAuthError,
  OAuthErrorCode,
  OAuthMetadata,
  OAuthTokenVerifier
} from '@modelcontextprotocol/server'
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose'
import * as openidClient from 'openid-client'
import { BACKEND_CACHE } from '../db.js'
import ENV from '../env.js'
import { logger } from '../logger.js'
import User from '../models/user.js'

const MCP_SCOPE = 'mcp'

export class McpConfigurationError extends Error {}

interface McpOAuthRuntime {
  audience: string
  issuer: string
  jwks: ReturnType<typeof createRemoteJWKSet>
  oauthMetadata: OAuthMetadata
}

let cachedRuntime: { key: string; value: Promise<McpOAuthRuntime> } | undefined

export function getMcpServerUrl() {
  return new URL(`${ENV.VITE_BACKEND_URL}/mcp`)
}

function getConfiguredOAuth() {
  const { connectionSettings } = BACKEND_CACHE.getSnapshot()
  const oidc = connectionSettings.auth.oidc
  const audience = connectionSettings.auth.mcp?.audience
  if (!oidc?.server || !oidc.clientId || !oidc.clientSecret || !audience) {
    throw new McpConfigurationError('MCP OAuth requires OIDC and an MCP audience in the connection settings')
  }
  return { oidc, audience }
}

async function discoverRuntime() {
  const { oidc, audience } = getConfiguredOAuth()
  const config = await openidClient.discovery(new URL(oidc.server), oidc.clientId, oidc.clientSecret, undefined, {
    execute: ENV.NODE_ENV === 'development' ? [openidClient.allowInsecureRequests] : []
  })
  const metadata = config.serverMetadata()
  if (!metadata.issuer || !metadata.jwks_uri) {
    throw new McpConfigurationError('The configured OIDC provider does not advertise issuer and jwks_uri')
  }
  return {
    audience,
    issuer: metadata.issuer,
    jwks: createRemoteJWKSet(new URL(metadata.jwks_uri)),
    oauthMetadata: metadata as unknown as OAuthMetadata
  }
}

export function getMcpOAuthRuntime() {
  const { oidc, audience } = getConfiguredOAuth()
  const key = `${oidc.server}\n${oidc.clientId}\n${oidc.clientSecret}\n${audience}`
  if (cachedRuntime?.key !== key) {
    const value = discoverRuntime().catch((error) => {
      if (cachedRuntime?.value === value) cachedRuntime = undefined
      throw error
    })
    cachedRuntime = { key, value }
  }
  return cachedRuntime.value
}

export function getScopes(payload: JWTPayload) {
  if (typeof payload.scope === 'string') {
    return payload.scope.split(/\s+/).filter(Boolean)
  }
  const scp = payload.scp
  if (typeof scp === 'string') {
    return scp.split(/\s+/).filter(Boolean)
  }
  if (Array.isArray(scp) && scp.every((scope) => typeof scope === 'string')) {
    return scp
  }
  return []
}

function invalidToken(message: string) {
  return new OAuthError(OAuthErrorCode.InvalidToken, message)
}

export const mcpTokenVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token) {
    try {
      const runtime = await getMcpOAuthRuntime()
      const { payload } = await jwtVerify(token, runtime.jwks, {
        issuer: runtime.issuer,
        audience: runtime.audience,
        requiredClaims: ['sub', 'exp']
      })
      if (!payload.sub || !payload.exp) throw invalidToken('The access token has no subject or expiry')

      const user = await User.findOne({ 'fk.oidc': payload.sub })
      if (!user || !(await user.isActive()) || !user.access.user) throw invalidToken('The access token is not linked to an active user')

      const scopes = getScopes(payload)
      const clientId =
        (typeof payload.client_id === 'string' && payload.client_id) ||
        (typeof payload.azp === 'string' && payload.azp) ||
        user._id.toString()
      return {
        token,
        clientId,
        scopes,
        expiresAt: payload.exp,
        resource: getMcpServerUrl(),
        extra: { userId: user._id.toString() }
      } satisfies AuthInfo
    } catch (error) {
      if (error instanceof OAuthError) throw error
      logger.debug('MCP access token validation failed', error)
      throw invalidToken('Invalid access token')
    }
  }
}

export async function getMcpAuthMetadata() {
  const runtime = await getMcpOAuthRuntime()
  const resourceServerUrl = getMcpServerUrl()
  return {
    oauthMetadata: runtime.oauthMetadata,
    protectedResourceMetadata: buildOAuthProtectedResourceMetadata({
      oauthMetadata: runtime.oauthMetadata,
      resourceServerUrl,
      scopesSupported: [MCP_SCOPE],
      resourceName: 'Abrechnung MCP',
      dangerouslyAllowInsecureIssuerUrl: ENV.NODE_ENV === 'development'
    })
  }
}

export { MCP_SCOPE }
