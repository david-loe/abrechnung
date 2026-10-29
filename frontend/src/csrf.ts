import axios, { AxiosHeaders, AxiosRequestConfig, RawAxiosHeaders } from 'axios'
import ENV from './env.js'

let token: string | undefined
let pending: Promise<string> | undefined
let generation = 0

export function clearCsrfToken() {
  generation++
  token = undefined
  pending = undefined
}

async function getCsrfToken() {
  if (token) return token
  if (!pending) {
    const started = generation
    const request = axios
      .get<{ csrfToken: string }>(`${ENV.VITE_BACKEND_URL}/auth/csrf`, { withCredentials: true })
      .then(({ data }) => {
        if (started !== generation) throw new Error('Session changed while loading the CSRF token')
        if (typeof data.csrfToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.csrfToken)) {
          throw new Error('Invalid CSRF token response')
        }
        token = data.csrfToken
        return token
      })
      .finally(() => {
        if (pending === request) pending = undefined
      })
    pending = request
  }
  return pending
}

/** Only call for credentialed writes to the configured backend. */
export async function cookieWriteConfig(requestUrl: string, config: AxiosRequestConfig = {}) {
  const backend = new URL(ENV.VITE_BACKEND_URL)
  const target = new URL(requestUrl)
  const backendPath = backend.pathname.replace(/\/$/, '')
  if (target.origin !== backend.origin || !target.pathname.startsWith(`${backendPath}/`)) {
    throw new Error('Refusing to send the CSRF token outside the configured backend')
  }
  const headers = new AxiosHeaders(config.headers as RawAxiosHeaders | undefined)
  headers.set('X-CSRF-Token', await getCsrfToken(), true)
  return { ...config, withCredentials: true, headers }
}
