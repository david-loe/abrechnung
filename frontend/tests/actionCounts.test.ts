import type { ActionCounts } from 'abrechnung-common/types.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { actionCountState, refreshActionCounts, startActionCountUpdates } from '@/actionCounts.js'
import { eventBus } from '@/eventBus.js'
import { clearStore, storeAuthContext } from '@/indexedDB.js'
import { initializeSession, purgeSession } from '@/session.js'
import { serve } from './http.js'

const counts: ActionCounts = {
  'approve/advance': 1,
  'approve/travel': 2,
  'examine/travel': 3,
  'examine/expenseReport': 4,
  'examine/healthCareCost': 5,
  'book/advance': 6,
  'book/travel': 7,
  'book/expenseReport': 8,
  'book/healthCareCost': 9
}
const meta = { count: 1, page: 1, limit: 1, countPages: 1 }
async function authenticate(scope = 'scope') {
  await storeAuthContext({ userId: 'user', cacheScope: scope, expiresAt: '2099-01-01T00:00:00Z', permissions: {} })
  await initializeSession()
}
beforeAll(() => {
  const document = new EventTarget()
  Object.defineProperty(document, 'visibilityState', { value: 'visible' })
  vi.stubGlobal('document', document)
  startActionCountUpdates()
})
beforeEach(async () => {
  serve(() => ({ data: { data: counts, meta } }))
  await purgeSession()
  await clearStore('session')
  window.dispatchEvent(new Event('online'))
  await authenticate()
})

function mutation(endpoint: string) {
  eventBus.dispatchEvent(new CustomEvent('api-mutation-succeeded', { detail: { endpoint, method: 'POST' } }))
}

describe('action counts through session and HTTP boundaries', () => {
  it('given server counts, the displayed total includes every actionable report', async () => {
    await refreshActionCounts()
    expect(actionCountState.counts.value).toEqual(counts)
    expect(actionCountState.total.value).toBe(45)
  })
  it('given concurrent refreshes, both callers receive the same pending result', async () => {
    const response = Promise.withResolvers<{ data: unknown }>()
    let requests = 0
    serve(() => {
      requests++
      return response.promise
    })
    const first = refreshActionCounts()
    const second = refreshActionCounts()
    response.resolve({ data: { data: counts, meta } })
    await Promise.all([first, second])
    expect(requests).toBe(1)
    expect(actionCountState.counts.value).toEqual(counts)
  })
  it('given a mutation during a refresh, the later server counts replace the stale response', async () => {
    const response = Promise.withResolvers<{ data: unknown }>()
    const fresh = { ...counts, 'approve/advance': 10 }
    let first = true
    serve(() => {
      if (first) {
        first = false
        return response.promise
      }
      return { data: { data: fresh, meta } }
    })
    const pending = refreshActionCounts()
    mutation('examine/travel/reviewCompleted')
    response.resolve({ data: { data: counts, meta } })
    await pending
    await vi.waitFor(() => expect(actionCountState.counts.value).toEqual(fresh))
  })
  it('given a session change during a refresh, stale counts never replace the new session counts', async () => {
    const response = Promise.withResolvers<{ data: unknown }>()
    const fresh = { ...counts, 'approve/advance': 20 }
    let first = true
    serve(() => {
      if (first) {
        first = false
        return response.promise
      }
      return { data: { data: fresh, meta } }
    })
    const pending = refreshActionCounts()
    await purgeSession()
    await authenticate('new-scope')
    const next = refreshActionCounts()
    response.resolve({ data: { data: counts, meta } })
    await Promise.all([pending, next])
    await vi.waitFor(() => expect(actionCountState.counts.value).toEqual(fresh))
  })
  it('given offline mode, counts stay unavailable without contacting the server', async () => {
    window.dispatchEvent(new Event('offline'))
    serve(() => {
      throw new Error('Offline counts must not reach the network')
    })
    await refreshActionCounts()
    expect(actionCountState.counts.value).toBeNull()
    expect(actionCountState.total.value).toBe(0)
  })
  it('given focus and workflow changes, counts refresh; personal settings leave the current counts alone', async () => {
    let value = counts
    let requests = 0
    serve(() => {
      requests++
      return { data: { data: value, meta } }
    })
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(actionCountState.counts.value).toEqual(counts))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requests).toBe(1)
    value = { ...counts, 'approve/advance': 30 }
    mutation('user/settings')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(requests).toBe(1)
    expect(actionCountState.counts.value).toEqual(counts)
    mutation('approve/advance/bulk')
    await vi.waitFor(() => expect(actionCountState.counts.value).toEqual(value))
    expect(requests).toBe(2)
  })
  it('given logout, current counts and total are cleared', async () => {
    await refreshActionCounts()
    await purgeSession()
    expect(actionCountState.counts.value).toBeNull()
    expect(actionCountState.total.value).toBe(0)
  })
})
