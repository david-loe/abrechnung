import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type { PasskeyAuthenticationOptions, PasskeyRegistrationOptions, PasskeySummary } from 'abrechnung-common/passkeys.js'
import axios from 'axios'
import API from '@/api.js'
import ENV from '@/env.js'

export function supportsPasskeys() {
  return window.isSecureContext && browserSupportsWebAuthn()
}

export function passkeyCancelled(error: unknown) {
  return error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')
}

export async function authenticatePasskey() {
  const config = { withCredentials: true }
  const { data } = await axios.post<PasskeyAuthenticationOptions>(`${ENV.VITE_BACKEND_URL}/auth/passkey/options`, {}, config)
  const response = await startAuthentication({ optionsJSON: data.optionsJSON })
  await axios.post(`${ENV.VITE_BACKEND_URL}/auth/passkey/verify`, { challengeId: data.challengeId, response }, config)
}

export async function registerPasskey(name: string) {
  const options = await API.setter<PasskeyRegistrationOptions>('user/passkeys/options', {}, {}, false)
  if (!options.ok) return
  const response = await startRegistration({ optionsJSON: options.ok.optionsJSON })
  const result = await API.setter<PasskeySummary>('user/passkeys/verify', { challengeId: options.ok.challengeId, response, name })
  return result.ok
}
