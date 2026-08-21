import type { ActionCounts } from 'abrechnung-common/types.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const testState = vi.hoisted(() => ({
  isOnline: { value: true },
  authContext: { value: { userId: 'user' } as object | null },
  purgeHandler: undefined as (() => void) | undefined
}))

vi.mock('@/api.js', () => ({ default: { getter: vi.fn() } }))
vi.mock('@/session.js', () => ({
  registerSessionPurgeHandler: (handler: () => void) => {
    testState.purgeHandler = handler
  },
  sessionState: { authContext: testState.authContext, isOnline: testState.isOnline }
}))

import { actionCountState, refreshActionCounts, startActionCountUpdates } from '@/actionCounts.js'
import API from '@/api.js'
import { eventBus } from '@/eventBus.js'

const actionCounts: ActionCounts = {
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

beforeAll(() => {
  const documentTarget = new EventTarget()
  Object.defineProperty(documentTarget, 'visibilityState', { configurable: true, value: 'visible' })
  vi.stubGlobal('document', documentTarget)
  startActionCountUpdates()
})

beforeEach(() => {
  vi.clearAllMocks()
  testState.isOnline.value = true
  testState.authContext.value = { userId: 'user' }
  testState.purgeHandler?.()
  vi.mocked(API.getter).mockResolvedValue({ ok: { data: actionCounts, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } })
})

describe('action counts', () => {
  it('loads counts and calculates their sum', async () => {
    await refreshActionCounts()

    expect(actionCountState.counts.value).toEqual(actionCounts)
    expect(actionCountState.total.value).toBe(45)
  })

  it('coalesces concurrent refreshes', async () => {
    let resolveRequest:
      | ((value: { ok: { data: ActionCounts; meta: { count: number; page: number; limit: number; countPages: number } } }) => void)
      | undefined
    vi.mocked(API.getter).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )

    const first = refreshActionCounts()
    const second = refreshActionCounts()
    expect(API.getter).toHaveBeenCalledOnce()
    resolveRequest?.({ ok: { data: actionCounts, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } })
    await Promise.all([first, second])
  })

  it('queues a fresh request when a status changes during an in-flight refresh', async () => {
    let resolveRequest:
      | ((value: { ok: { data: ActionCounts; meta: { count: number; page: number; limit: number; countPages: number } } }) => void)
      | undefined
    vi.mocked(API.getter)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve
        })
      )
      .mockResolvedValueOnce({ ok: { data: actionCounts, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } })

    const first = refreshActionCounts()
    eventBus.dispatchEvent(
      new CustomEvent('api-mutation-succeeded', { detail: { endpoint: 'examine/travel/reviewCompleted', method: 'POST' } })
    )
    resolveRequest?.({ ok: { data: actionCounts, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } })
    await first

    await vi.waitFor(() => expect(API.getter).toHaveBeenCalledTimes(2))
  })

  it('queues a fresh request when the session changes during an in-flight refresh', async () => {
    let resolveRequest:
      | ((value: { ok: { data: ActionCounts; meta: { count: number; page: number; limit: number; countPages: number } } }) => void)
      | undefined
    const freshCounts = { ...actionCounts, 'approve/advance': 10 }
    vi.mocked(API.getter)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRequest = resolve
        })
      )
      .mockResolvedValueOnce({ ok: { data: freshCounts, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } })

    const staleRequest = refreshActionCounts()
    testState.purgeHandler?.()
    const sessionRequest = refreshActionCounts()

    expect(API.getter).toHaveBeenCalledOnce()
    resolveRequest?.({ ok: { data: actionCounts, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } })
    await Promise.all([staleRequest, sessionRequest])

    await vi.waitFor(() => expect(API.getter).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(actionCountState.counts.value).toEqual(freshCounts))
  })

  it('does not request counts while offline', async () => {
    testState.isOnline.value = false
    await refreshActionCounts()

    expect(API.getter).not.toHaveBeenCalled()
    expect(actionCountState.counts.value).toBeNull()
  })

  it('refreshes on focus and relevant successful mutations only', async () => {
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(API.getter).toHaveBeenCalledTimes(1))

    eventBus.dispatchEvent(new CustomEvent('api-mutation-succeeded', { detail: { endpoint: 'user/settings', method: 'POST' } }))
    await Promise.resolve()
    expect(API.getter).toHaveBeenCalledTimes(1)

    eventBus.dispatchEvent(
      new CustomEvent('api-mutation-succeeded', { detail: { endpoint: 'examine/travel/reviewCompleted', method: 'POST' } })
    )
    await vi.waitFor(() => expect(API.getter).toHaveBeenCalledTimes(2))

    eventBus.dispatchEvent(new CustomEvent('api-mutation-succeeded', { detail: { endpoint: 'approve/advance/bulk', method: 'POST' } }))
    await vi.waitFor(() => expect(API.getter).toHaveBeenCalledTimes(3))
  })

  it('clears counts with the session', async () => {
    await refreshActionCounts()
    testState.purgeHandler?.()

    expect(actionCountState.counts.value).toBeNull()
    expect(actionCountState.total.value).toBe(0)
  })
})
