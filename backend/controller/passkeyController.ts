import {
  type AuthenticatorTransport,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server'
import { Body, Controller, Delete, Get, Middlewares, Path, Post, Request, Route, Security, Tags } from '@tsoa/runtime'
import type {
  PasskeyAuthenticationOptions,
  PasskeyAuthenticationResponse,
  PasskeyRegistrationOptions,
  PasskeyRegistrationResponse,
  PasskeySummary
} from 'abrechnung-common/passkeys.js'
import type { Request as ExRequest } from 'express'
import { mongo, Types } from 'mongoose'
import { requireTrustedOrigin } from '../csrf.js'
import Passkey from '../models/passkey.js'
import User from '../models/user.js'
import {
  consumePasskeyChallenge,
  passkeyName,
  passkeyOrigin,
  passkeyRpID,
  passkeyUserID,
  requirePasskeysEnabled,
  savePasskeyChallenge
} from '../passkeys.js'
import { AuthorizationError, ConflictError, NotFoundError } from './error.js'
import type { AuthenticatedExpressRequest } from './types.js'

function summary(passkey: { _id: Types.ObjectId; name: string; createdAt: Date; lastUsedAt?: Date | null }) {
  return {
    _id: passkey._id.toString(),
    name: passkey.name,
    createdAt: passkey.createdAt.toISOString(),
    ...(passkey.lastUsedAt ? { lastUsedAt: passkey.lastUsedAt.toISOString() } : {})
  } satisfies PasskeySummary
}

@Tags('Auth')
@Route('auth/passkey')
export class PasskeyAuthController extends Controller {
  @Post('options')
  @Middlewares(requireTrustedOrigin)
  public async options(@Request() req: ExRequest) {
    requirePasskeysEnabled()
    this.setHeader('Cache-Control', 'no-store')
    const optionsJSON = await generateAuthenticationOptions({ rpID: passkeyRpID, userVerification: 'required' })
    const challengeId = await savePasskeyChallenge(req, 'authentication', optionsJSON.challenge)
    const result: PasskeyAuthenticationOptions = { optionsJSON, challengeId }
    return result
  }

  @Post('verify')
  @Middlewares(requireTrustedOrigin)
  public async verify(@Request() req: ExRequest, @Body() body: { challengeId: string; response: PasskeyAuthenticationResponse }) {
    requirePasskeysEnabled()
    const expectedChallenge = await consumePasskeyChallenge(req, body.challengeId, 'authentication')
    const credential = await Passkey.findOne({ credentialId: body.response.id })
    if (!credential) throw new AuthorizationError()
    const user = await User.findById(credential.user)
    if (
      !user ||
      !(await user.isActive()) ||
      body.response.response.userHandle !== Buffer.from(passkeyUserID(user._id)).toString('base64url')
    ) {
      throw new AuthorizationError()
    }
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: passkeyOrigin,
      expectedRPID: passkeyRpID,
      requireUserVerification: true,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransport[]
      }
    }).catch(() => {
      throw new AuthorizationError()
    })
    if (!verification.verified) throw new AuthorizationError()
    requirePasskeysEnabled()
    const updated = await Passkey.updateOne(
      { _id: credential._id, counter: credential.counter },
      {
        $set: {
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: new Date(),
          backedUp: verification.authenticationInfo.credentialBackedUp
        }
      }
    )
    if (!updated.matchedCount) throw new AuthorizationError()
    await new Promise<void>((resolve, reject) => req.logIn(user, (error) => (error ? reject(error) : resolve())))
    this.setStatus(204)
  }
}

@Tags('User')
@Route('user/passkeys')
@Security('cookieAuth')
export class PasskeyController extends Controller {
  @Get()
  public async list(@Request() req: AuthenticatedExpressRequest) {
    this.setHeader('Cache-Control', 'no-store')
    const passkeys = await Passkey.find({ user: req.user._id }).select('name createdAt lastUsedAt').sort({ createdAt: 1 })
    return { data: passkeys.map(summary) }
  }

  @Post('options')
  public async options(@Request() req: AuthenticatedExpressRequest) {
    requirePasskeysEnabled()
    this.setHeader('Cache-Control', 'no-store')
    const credentials = await Passkey.find({ user: req.user._id })
    const optionsJSON = await generateRegistrationOptions({
      rpName: 'Abrechnung',
      rpID: passkeyRpID,
      userID: passkeyUserID(req.user._id),
      userName: req.user.email,
      userDisplayName: `${req.user.name.givenName} ${req.user.name.familyName}`,
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as AuthenticatorTransport[]
      }))
    })
    const challengeId = await savePasskeyChallenge(req, 'registration', optionsJSON.challenge, req.user._id)
    const result: PasskeyRegistrationOptions = { optionsJSON, challengeId }
    return { result }
  }

  @Post('verify')
  public async register(
    @Request() req: AuthenticatedExpressRequest,
    @Body() body: { challengeId: string; response: PasskeyRegistrationResponse; name: string }
  ) {
    requirePasskeysEnabled()
    const name = passkeyName(body.name)
    const expectedChallenge = await consumePasskeyChallenge(req, body.challengeId, 'registration', req.user._id)
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: passkeyOrigin,
      expectedRPID: passkeyRpID,
      requireUserVerification: true
    }).catch(() => {
      throw new AuthorizationError()
    })
    if (!verification.verified || !verification.registrationInfo) throw new AuthorizationError()
    requirePasskeysEnabled()
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
    const passkey = await Passkey.create({
      user: req.user._id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name
    }).catch((error: unknown) => {
      if (error instanceof mongo.MongoServerError && error.code === 11000) throw new ConflictError('Passkey already registered')
      throw error
    })
    return { message: 'alerts.successSaving', result: summary(passkey) }
  }

  @Post('{id}')
  public async rename(@Request() req: AuthenticatedExpressRequest, @Path() id: string, @Body() body: { name: string }) {
    const name = passkeyName(body.name)
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError()
    const passkey = await Passkey.findOneAndUpdate({ _id: id, user: req.user._id }, { $set: { name } }, { returnDocument: 'after' })
    if (!passkey) throw new NotFoundError()
    return { message: 'alerts.successSaving', result: summary(passkey) }
  }

  @Delete('{id}')
  public async remove(@Request() req: AuthenticatedExpressRequest, @Path() id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError()
    const deleted = await Passkey.deleteOne({ _id: id, user: req.user._id })
    if (!deleted.deletedCount) throw new NotFoundError()
    return { message: 'alerts.successDeleting' }
  }
}
