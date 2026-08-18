import {
  getOAuthProtectedResourceMetadataUrl,
  hostHeaderValidation,
  originValidation,
  requireBearerAuth
} from '@modelcontextprotocol/express'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { createMcpHandler } from '@modelcontextprotocol/server'
import express, { Express, NextFunction, Request, Response } from 'express'
import ENV from '../env.js'
import { logger } from '../logger.js'
import User from '../models/user.js'
import { getMcpAuthMetadata, getMcpOAuthRuntime, getMcpServerUrl, MCP_SCOPE, mcpTokenVerifier } from './auth.js'
import { createMcpServer } from './tools.js'

const mcpHandler = createMcpHandler(
  async ({ authInfo }) => {
    const userId = authInfo?.extra?.userId
    const user = typeof userId === 'string' ? await User.findById(userId) : null
    if (!user || !(await user.isActive()) || !user.access.user) throw new Error('Authenticated MCP user is no longer active')
    return createMcpServer(user)
  },
  { legacy: 'reject', onerror: (error) => logger.warn(error) }
)

const nodeHandler = toNodeHandler(mcpHandler, { onerror: (error) => logger.warn(error) })
const mcpServerUrl = getMcpServerUrl()
const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(mcpServerUrl)
const allowedHosts = Array.from(new Set([new URL(ENV.VITE_BACKEND_URL).hostname, 'localhost', '127.0.0.1']))
const allowedOrigins = Array.from(
  new Set([new URL(ENV.VITE_BACKEND_URL).hostname, new URL(ENV.VITE_FRONTEND_URL).hostname, 'localhost', '127.0.0.1'])
)
const validateHost = hostHeaderValidation(allowedHosts)
const validateOrigin = originValidation(allowedOrigins)

async function requireMcpConfiguration(_req: Request, res: Response, next: NextFunction) {
  try {
    await getMcpOAuthRuntime()
    next()
  } catch (error) {
    logger.warn(error)
    res.status(503).json({ error: 'mcp_not_configured', error_description: 'MCP OAuth is not configured or unavailable' })
  }
}

async function protectedResourceMetadata(_req: Request, res: Response) {
  try {
    const metadata = await getMcpAuthMetadata()
    res.removeHeader('Access-Control-Allow-Credentials')
    res.set('Access-Control-Allow-Origin', '*').json(metadata.protectedResourceMetadata)
  } catch (error) {
    logger.warn(error)
    res.status(503).json({ error: 'mcp_not_configured' })
  }
}

export function registerMcpRoutes(app: Express) {
  const guards = [validateHost, validateOrigin]
  app.get(new URL(resourceMetadataUrl).pathname, ...guards, protectedResourceMetadata)
  app.all(
    '/mcp',
    ...guards,
    express.json({ limit: Math.ceil((ENV.VITE_MAX_FILE_SIZE * 4) / 3) + 1_000_000 }),
    requireMcpConfiguration,
    requireBearerAuth({ verifier: mcpTokenVerifier, requiredScopes: [MCP_SCOPE], resourceMetadataUrl }),
    (req, res) => {
      logger.debug(`${req.auth?.extra?.userId ?? 'Guest'} -> MCP ${req.header('Mcp-Method') ?? 'unknown'} ${req.header('Mcp-Name') ?? ''}`)
      void nodeHandler(req, res, req.body)
    }
  )
}

export async function closeMcpServer() {
  await mcpHandler.close()
}
