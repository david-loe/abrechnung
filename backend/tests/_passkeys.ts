import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { passkeyOrigin, passkeyRpID } from '../passkeys.js'

// Minimal independent CBOR encoder for a virtual ES256 authenticator's public data.
function cbor(value: string | number | Buffer | Map<string | number, unknown>) {
  const head = (major: number, length: number) =>
    length < 24 ? Buffer.from([major * 32 + length]) : Buffer.from([major * 32 + 24, length])
  if (typeof value === 'number') return head(value < 0 ? 1 : 0, value < 0 ? -1 - value : value)
  if (typeof value === 'string') return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)])
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value])
  const entries: Buffer[] = []
  for (const [key, item] of value) entries.push(cbor(key), cbor(item as Parameters<typeof cbor>[0]))
  return Buffer.concat([head(5, value.size), ...entries])
}

export function virtualPasskey(userHandle: string) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const { x, y } = publicKey.export({ format: 'jwk' })
  if (!x || !y) throw new Error('ES256 key coordinates are missing')
  const credentialID = randomBytes(32)
  const id = credentialID.toString('base64url')
  const hash = (data: string | Buffer) => createHash('sha256').update(data).digest()
  const clientData = (type: string, challenge: string, origin: string) =>
    Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }))
  const authData = (rpID: string, flags: number, counter: number) => {
    const count = Buffer.alloc(4)
    count.writeUInt32BE(counter)
    return Buffer.concat([hash(rpID), Buffer.from([flags]), count])
  }
  return {
    id,
    registration(challenge: string, options: { origin?: string; rpID?: string; verified?: boolean } = {}) {
      const cose = cbor(
        new Map<number, unknown>([
          [1, 2],
          [3, -7],
          [-1, 1],
          [-2, Buffer.from(x, 'base64url')],
          [-3, Buffer.from(y, 'base64url')]
        ])
      )
      const length = Buffer.alloc(2)
      length.writeUInt16BE(credentialID.length)
      const authenticatorData = Buffer.concat([
        authData(options.rpID ?? passkeyRpID, options.verified === false ? 0x41 : 0x45, 0),
        Buffer.alloc(16),
        length,
        credentialID,
        cose
      ])
      return {
        id,
        rawId: id,
        type: 'public-key',
        clientExtensionResults: { credProps: { rk: true } },
        response: {
          clientDataJSON: clientData('webauthn.create', challenge, options.origin ?? passkeyOrigin).toString('base64url'),
          attestationObject: cbor(
            new Map<string, unknown>([
              ['fmt', 'none'],
              ['attStmt', new Map()],
              ['authData', authenticatorData]
            ])
          ).toString('base64url'),
          transports: ['internal']
        }
      } satisfies RegistrationResponseJSON
    },
    authentication(
      challenge: string,
      options: { origin?: string; rpID?: string; verified?: boolean; counter?: number; handle?: string } = {}
    ) {
      const client = clientData('webauthn.get', challenge, options.origin ?? passkeyOrigin)
      const authenticatorData = authData(options.rpID ?? passkeyRpID, options.verified === false ? 0x01 : 0x05, options.counter ?? 1)
      return {
        id,
        rawId: id,
        type: 'public-key',
        clientExtensionResults: {},
        response: {
          clientDataJSON: client.toString('base64url'),
          authenticatorData: authenticatorData.toString('base64url'),
          signature: sign('sha256', Buffer.concat([authenticatorData, hash(client)]), privateKey).toString('base64url'),
          userHandle: options.handle ?? userHandle
        }
      } satisfies AuthenticationResponseJSON
    }
  }
}
