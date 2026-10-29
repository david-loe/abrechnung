import { CanceledError } from 'axios'
import { beforeEach, describe, expect, it } from 'vitest'
import API from '@/api.js'
import { readAuthContext, storeAuthContext } from '@/indexedDB.js'
import { initializeSession, purgeSession, sessionState } from '@/session.js'
import { serve } from './http.js'

const context = { userId: 'owner', cacheScope: 'scope', expiresAt: '2099-01-01T00:00:00Z', permissions: {} }
beforeEach(async () => {
  await purgeSession()
  await storeAuthContext(context)
  await initializeSession()
  API.alerts.splice(0)
  serve(() => ({ status: 401, data: { message: 'Unauthorized' } }))
})

describe('API authentication errors', () => {
  it('given an expected authorization failure, the current session remains available', async () => {
    await API.getter('users', {}, {}, { showAlert: false, handleAuthenticationError: false })
    expect(sessionState.authContext.value).toEqual(context)
    expect(await readAuthContext()).toEqual(context)
  })
  it('given an expired authenticated request, both memory and persisted authentication are cleared', async () => {
    await API.getter('user')
    expect(sessionState.authContext.value).toBeNull()
    expect(await readAuthContext()).toBeUndefined()
  })
  it('given a canceled request, no alert or authentication change occurs', async () => {
    const error = new CanceledError('canceled')
    serve(() => {
      throw error
    })
    expect(await API.getter('travel')).toEqual({ error })
    expect(sessionState.authContext.value).toEqual(context)
    expect(API.alerts).toEqual([])
  })
})
