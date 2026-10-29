import { beforeEach, describe, expect, it } from 'vitest'
import API from '@/api.js'
import { clearCsrfToken, cookieWriteConfig } from '@/csrf.js'
import { clearStore, hasLogoutTombstone, readAuthContext, setLogoutTombstone } from '@/indexedDB.js'
import { beginLogout, prepareLogin, purgeSession, refreshAuthContext } from '@/session.js'
import { requestBody, serve } from './http.js'

const backend = 'http://backend.test'
const token = 'a'.repeat(43)
const nextToken = 'b'.repeat(43)
const context = { userId: 'owner', cacheScope: 'scope', expiresAt: '2099-01-01T00:00:00Z', permissions: {} }

beforeEach(async () => {
  await purgeSession()
  await clearStore('session')
})

describe('CSRF tokens at the HTTP boundary', () => {
  it('shares the token request across concurrent writes, preserves headers and sends no token on reads', async () => {
    const tokenRequested = Promise.withResolvers<void>()
    const reply = Promise.withResolvers<void>()
    const writes: { token: unknown; content: unknown; body: unknown }[] = []
    let tokenRequests = 0
    serve(
      async (request) => {
        if (request.url === `${backend}/auth/csrf`) {
          tokenRequests++
          tokenRequested.resolve()
          await reply.promise
          expect(request.withCredentials).toBe(true)
          expect(request.headers.get('X-CSRF-Token')).toBeUndefined()
          return { data: { csrfToken: token } }
        }
        if (request.method === 'get') {
          expect(request.headers.get('X-CSRF-Token')).toBeUndefined()
          return { data: { data: context } }
        }
        expect(request.withCredentials).toBe(true)
        writes.push({ token: request.headers.get('X-CSRF-Token'), content: request.headers.get('X-Example'), body: requestBody(request) })
        return { data: { result: { saved: true } } }
      },
      { csrf: false }
    )
    const first = API.setter('user/settings', { language: 'de' }, { headers: { 'X-Example': 'preserved', 'X-CSRF-Token': false } }, false)
    const second = API.deleter('documentFile', { _id: 'file' }, false, { success: false, error: false })
    try {
      await tokenRequested.promise
      expect(tokenRequests).toBe(1)
    } finally {
      reply.resolve()
    }
    await Promise.all([first, second])
    await API.getter('user')
    expect(writes).toHaveLength(2)
    expect(writes.every((write) => write.token === token)).toBe(true)
    expect(writes.find((write) => write.content === 'preserved')?.body).toEqual({ language: 'de' })
    expect(tokenRequests).toBe(1)
    expect(await readAuthContext()).toBeUndefined()
  })

  it('rejects a token response that arrives after session purge and does not reuse it', async () => {
    const requested = Promise.withResolvers<void>()
    const reply = Promise.withResolvers<void>()
    let requests = 0
    serve(
      async () => {
        requests++
        if (requests === 1) {
          requested.resolve()
          await reply.promise
          return { data: { csrfToken: token } }
        }
        return { data: { csrfToken: nextToken } }
      },
      { csrf: false }
    )
    const old = cookieWriteConfig(`${backend}/user/settings`)
    const rejected = expect(old).rejects.toThrow('Session changed')
    try {
      await requested.promise
      await purgeSession()
    } finally {
      reply.resolve()
    }
    await rejected
    expect((await cookieWriteConfig(`${backend}/user/settings`)).headers.get('X-CSRF-Token')).toBe(nextToken)
    expect(requests).toBe(2)
  })

  it('refreshes the token after an online session refresh without persisting it in AuthContext', async () => {
    let requests = 0
    serve(
      (request) => {
        if (request.url === `${backend}/auth/authenticated`) return { data: context }
        requests++
        return { data: { csrfToken: requests === 1 ? token : nextToken } }
      },
      { csrf: false }
    )
    expect((await cookieWriteConfig(`${backend}/user/settings`)).headers.get('X-CSRF-Token')).toBe(token)
    expect(await refreshAuthContext()).toEqual(context)
    expect((await cookieWriteConfig(`${backend}/user/settings`)).headers.get('X-CSRF-Token')).toBe(nextToken)
    expect(await readAuthContext()).toEqual(context)
  })

  it('finishes a pending logout after local purge by loading the token using the remaining cookie', async () => {
    const requests: string[] = []
    serve(
      (request) => {
        requests.push(`${request.method} ${request.url}`)
        expect(request.withCredentials).toBe(true)
        if (request.method === 'get') return { data: { csrfToken: token } }
        expect(request.headers.get('X-CSRF-Token')).toBe(token)
        return { status: 204, data: {} }
      },
      { csrf: false }
    )
    await beginLogout()
    expect(await prepareLogin()).toBe(true)
    expect(await hasLogoutTombstone()).toBe(false)
    expect(requests).toEqual([`get ${backend}/auth/csrf`, `delete ${backend}/auth/logout`])
  })

  it('retains an offline logout until reconnection permits the token fetch and server logout', async () => {
    const requests: string[] = []
    const online = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    serve(
      (request) => {
        requests.push(`${request.method} ${request.url}`)
        return request.method === 'get' ? { data: { csrfToken: token } } : { status: 204, data: {} }
      },
      { csrf: false }
    )
    try {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      await beginLogout()
      expect(await prepareLogin()).toBe(false)
      expect(await hasLogoutTombstone()).toBe(true)
      expect(requests).toEqual([])
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
      expect(await prepareLogin()).toBe(true)
      expect(await hasLogoutTombstone()).toBe(false)
      expect(requests).toEqual([`get ${backend}/auth/csrf`, `delete ${backend}/auth/logout`])
    } finally {
      if (online) Object.defineProperty(navigator, 'onLine', online)
    }
  })

  it('does not send a mutation when token acquisition fails and does not retry rejected writes', async () => {
    const writes: (string | undefined)[] = []
    serve(
      (request) => {
        if (request.method === 'get') return { status: 401, data: { message: 'Session expired' } }
        writes.push(request.url)
        return { data: {} }
      },
      { csrf: false }
    )
    await API.setter('user/settings', {}, {}, false)
    expect(writes).toEqual([])
    serve(
      (request) => {
        if (request.method === 'get') return { data: { csrfToken: token } }
        writes.push(request.url)
        return { status: 401, data: { message: 'Invalid CSRF token' } }
      },
      { csrf: false }
    )
    await API.setter('user/settings', {}, {}, false)
    expect(writes).toEqual([`${backend}/user/settings`])
  })

  it('clears a pending logout when its cookie session has already expired', async () => {
    await setLogoutTombstone()
    serve(() => ({ status: 401, data: {} }), { csrf: false })
    expect(await prepareLogin()).toBe(true)
    expect(await hasLogoutTombstone()).toBe(false)
  })

  it('keeps a pending logout when the server refuses its token or Origin', async () => {
    await setLogoutTombstone()
    serve((request) => (request.method === 'get' ? { data: { csrfToken: token } } : { status: 401, data: {} }), { csrf: false })
    await expect(prepareLogin()).rejects.toThrow('HTTP 401')
    expect(await hasLogoutTombstone()).toBe(true)
  })

  it('refuses destinations outside the backend before requesting a token', async () => {
    let requests = 0
    serve(
      () => {
        requests++
        return { data: { csrfToken: token } }
      },
      { csrf: false }
    )
    await expect(cookieWriteConfig('https://attacker.invalid/user/settings')).rejects.toThrow('outside the configured backend')
    expect(requests).toBe(0)
  })

  it('can retry token acquisition after a network error or an invalid response', async () => {
    let requests = 0
    serve(
      () => {
        requests++
        if (requests === 1) throw new Error('Network unavailable')
        if (requests === 2) return { data: { csrfToken: 'invalid' } }
        return { data: { csrfToken: token } }
      },
      { csrf: false }
    )
    await expect(cookieWriteConfig(`${backend}/user/settings`)).rejects.toThrow('Network unavailable')
    await expect(cookieWriteConfig(`${backend}/user/settings`)).rejects.toThrow('Invalid CSRF token response')
    expect((await cookieWriteConfig(`${backend}/user/settings`)).headers.get('X-CSRF-Token')).toBe(token)
    clearCsrfToken()
  })
})
