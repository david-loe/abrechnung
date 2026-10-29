import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextFunction, Request, Response } from 'express'
import { AuthorizationError } from './controller/error.js'
import ENV from './env.js'

export const trustedOrigins = [...new Set([new URL(ENV.VITE_FRONTEND_URL).origin, new URL(ENV.VITE_BACKEND_URL).origin])]
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction) {
  if (!trustedOrigins.includes(req.get('Origin') ?? '')) throw new AuthorizationError('Untrusted request origin')
  next()
}

export function createCsrfToken(req: Request) {
  // Bind the token to the session without exposing its ID or writing session data.
  return createHmac('sha256', ENV.COOKIE_SECRET).update('abrechnung:csrf:v1\0').update(req.sessionID).digest('base64url')
}

export function validateCookieRequest(req: Request) {
  if (safeMethods.has(req.method)) return
  if (!trustedOrigins.includes(req.get('Origin') ?? '')) throw new AuthorizationError('Untrusted request origin')
  const token = req.get('X-CSRF-Token')
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(createCsrfToken(req)))) {
    throw new AuthorizationError('Invalid CSRF token')
  }
}
