import { createHmac } from 'node:crypto'
import type { Request } from 'express'
import { Types } from 'mongoose'
import { AuthorizationError, NotImplementedError, ValidationClientError } from './controller/error.js'
import { BACKEND_CACHE } from './db.js'
import ENV from './env.js'
import PasskeyChallenge from './models/passkeyChallenge.js'

const frontend = new URL(ENV.VITE_FRONTEND_URL)
export const passkeyRpID = frontend.hostname
export const passkeyOrigin = frontend.origin

export function requirePasskeysEnabled() {
  if (!BACKEND_CACHE.displaySettings.auth.passkey) throw new NotImplementedError('Passkeys are disabled')
}

export function passkeyUserID(userId: Types.ObjectId) {
  return new Uint8Array(userId.id)
}

function sessionBinding(req: Request) {
  return createHmac('sha256', ENV.COOKIE_SECRET).update('abrechnung:passkey\0').update(req.sessionID).digest('base64url')
}

export async function savePasskeyChallenge(
  req: Request,
  purpose: 'registration' | 'authentication',
  challenge: string,
  user?: Types.ObjectId
) {
  // Persist even an anonymous session before the browser returns with its credential.
  req.session.passkeySession = true
  await new Promise<void>((resolve, reject) => req.session.save((error) => (error ? reject(error) : resolve())))
  const pending = await PasskeyChallenge.create({
    session: sessionBinding(req),
    purpose,
    challenge,
    user,
    expiresAt: new Date(Date.now() + 300_000)
  })
  return pending._id.toString()
}

export async function consumePasskeyChallenge(
  req: Request,
  challengeId: string,
  purpose: 'registration' | 'authentication',
  user?: Types.ObjectId
) {
  if (!Types.ObjectId.isValid(challengeId)) throw new AuthorizationError()
  // Atomic consumption prevents replay, including simultaneous verification requests.
  const pending = await PasskeyChallenge.findOneAndDelete({
    _id: challengeId,
    session: sessionBinding(req),
    purpose,
    user,
    expiresAt: { $gt: new Date() }
  })
  if (!pending) throw new AuthorizationError()
  return pending.challenge
}

export function passkeyName(name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 100) throw new ValidationClientError('Passkey name must contain 1–100 characters')
  return trimmed
}
