import axios from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearStore,
  hasLogoutTombstone,
  readAuthContext,
  readFromDB,
  setLogoutTombstone,
  storeAuthContext,
  storeRequestToDB
} from '@/indexedDB.js'

vi.mock('axios', () => ({ default: { delete: vi.fn(), get: vi.fn(), isAxiosError: vi.fn(() => false) } }))

import {
  beginLogout,
  getValidOfflineContext,
  initializeSession,
  prepareLogin,
  refreshAuthContext,
  registerSessionPurgeHandler
} from '@/session.js'

beforeEach(async () => {
  vi.clearAllMocks()
  await clearStore('urls')
  await clearStore('session')
})

describe('offline session lifecycle', () => {
  it('rejects expired authentication contexts', async () => {
    await storeAuthContext({ userId: 'user-a', cacheScope: 'scope-a', expiresAt: new Date(Date.now() - 1).toISOString(), permissions: {} })
    await initializeSession()
    expect(await getValidOfflineContext()).toBeNull()
  })

  it('awaits registered reset handlers and leaves a logout tombstone', async () => {
    const reset = vi.fn(async () => undefined)
    const unregister = registerSessionPurgeHandler(reset)
    await beginLogout()
    expect(reset).toHaveBeenCalledOnce()
    expect(await hasLogoutTombstone()).toBe(true)
    unregister()
  })

  it('completes a pending logout before enabling a new login', async () => {
    await setLogoutTombstone()
    vi.mocked(axios.delete).mockResolvedValueOnce({} as never)
    expect(await prepareLogin()).toBe(true)
    expect(axios.delete).toHaveBeenCalledOnce()
    expect(await hasLogoutTombstone()).toBe(false)
  })

  it('purges persisted private data when the server returns a different scope', async () => {
    const previous = { userId: 'user-a', cacheScope: 'scope-a', expiresAt: new Date(Date.now() + 60_000).toISOString(), permissions: {} }
    const next = { ...previous, cacheScope: 'scope-b' }
    await storeAuthContext(previous)
    await storeRequestToDB({ data: [], meta: { count: 0, page: 1, limit: 10, countPages: 0 } }, 'cached-request', previous)
    vi.mocked(axios.get).mockResolvedValueOnce({ data: next } as never)

    await refreshAuthContext()

    expect(await readFromDB('urls', 'cached-request')).toBeUndefined()
    expect(await readAuthContext()).toEqual(next)
  })
})
