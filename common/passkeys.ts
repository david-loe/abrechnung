export interface PasskeySummary {
  _id: string
  name: string
  createdAt: string
  lastUsedAt?: string
}

export type PasskeyTransport = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb'

// Explicit wire types keep tsoa independent of the WebAuthn DOM extension types.
export interface PasskeyAuthenticationOptions {
  challengeId: string
  optionsJSON: {
    challenge: string
    rpId?: string
    timeout?: number
    userVerification?: 'required' | 'preferred' | 'discouraged'
    allowCredentials?: { id: string; type: string; transports?: string[] }[]
  }
}

export interface PasskeyRegistrationOptions {
  challengeId: string
  optionsJSON: {
    challenge: string
    rp: { name: string; id?: string }
    user: { id: string; name: string; displayName: string }
    pubKeyCredParams: { type: 'public-key'; alg: number }[]
    timeout?: number
    attestation?: 'none' | 'indirect' | 'direct' | 'enterprise'
    authenticatorSelection?: {
      residentKey?: 'required' | 'preferred' | 'discouraged'
      requireResidentKey?: boolean
      userVerification?: 'required' | 'preferred' | 'discouraged'
      authenticatorAttachment?: 'platform' | 'cross-platform'
    }
    excludeCredentials?: { id: string; type: string; transports?: string[] }[]
  }
}

export interface PasskeyAuthenticationResponse {
  id: string
  rawId: string
  type: 'public-key'
  clientExtensionResults: { credProps?: { rk?: boolean } }
  response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string }
}

export interface PasskeyRegistrationResponse {
  id: string
  rawId: string
  type: 'public-key'
  clientExtensionResults: { credProps?: { rk?: boolean } }
  response: { clientDataJSON: string; attestationObject: string; transports?: PasskeyTransport[] }
}
