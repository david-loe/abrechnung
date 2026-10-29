import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStore,
  hasLogoutTombstone,
  readAuthContext,
  readFromDB,
  setLogoutTombstone,
  storeAuthContext,
  storeRequestToDB
} from '@/indexedDB.js'
import {
  beginLogout,
  getValidOfflineContext,
  initializeSession,
  prepareLogin,
  purgeSession,
  refreshAuthContext,
  registerSessionPurgeHandler
} from '@/session.js'
import { serve } from './http.js'

beforeEach(async () => {
  await purgeSession()
  await clearStore('session')
})

describe('offline session lifecycle', () => {
  it('given expired authentication, offline access is unavailable and private data is removed', async () => {
    await storeAuthContext({ userId: 'user-a', cacheScope: 'scope-a', expiresAt: new Date(Date.now() - 1).toISOString(), permissions: {} })
    await initializeSession()
    expect(await getValidOfflineContext()).toBeNull()
    expect(await readAuthContext()).toBeUndefined()
  })
  it('given a pending reset, logout waits for completion and leaves a tombstone', async () => {
    const reset = Promise.withResolvers<void>()
    const invoked = Promise.withResolvers<void>()
    let finished = false
    const unregister = registerSessionPurgeHandler(() => {
      invoked.resolve()
      return reset.promise
    })
    try {
      const logout = beginLogout().then(() => {
        finished = true
      })
      await invoked.promise
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(finished).toBe(false)
      reset.resolve()
      await logout
      expect(finished).toBe(true)
      expect(await hasLogoutTombstone()).toBe(true)
    } finally {
      reset.resolve()
      unregister()
    }
  })
  it('given a pending logout, a new login is enabled only after server logout succeeds', async () => {
    await setLogoutTombstone()
    serve(() => ({ status: 503, data: {} }))
    await expect(prepareLogin()).rejects.toThrow('HTTP 503')
    expect(await hasLogoutTombstone()).toBe(true)
    serve(() => ({ data: {} }))
    expect(await prepareLogin()).toBe(true)
    expect(await hasLogoutTombstone()).toBe(false)
  })
  it('given a changed authentication scope, private cached responses are removed before the new context is used', async () => {
    const previous = { userId: 'user-a', cacheScope: 'scope-a', expiresAt: '2099-01-01T00:00:00Z', permissions: {} }
    const next = { ...previous, cacheScope: 'scope-b' }
    await storeAuthContext(previous)
    await initializeSession()
    await storeRequestToDB({ data: [], meta: { count: 0, page: 1, limit: 10, countPages: 0 } }, 'cached-request', previous)
    serve(() => ({ data: next }))
    expect(await refreshAuthContext()).toEqual(next)
    expect(await readFromDB('urls', 'cached-request')).toBeUndefined()
    expect(await readAuthContext()).toEqual(next)
  })
})
