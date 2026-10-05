import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createListRequests, watchListRequests } from '@/components/elements/listRequests.js'

function fixture() {
  const pending: { signal: AbortSignal; resolve: (value: string) => void; reject: (error: unknown) => void }[] = []
  const apply = vi.fn()
  const setLoading = vi.fn()
  const onError = vi.fn()
  const request = vi.fn((signal: AbortSignal) => new Promise<string>((resolve, reject) => pending.push({ signal, resolve, reject })))
  const requests = createListRequests({ request, apply, setLoading, onError })
  return { requests, request, pending, apply, setLoading, onError }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('list requests', () => {
  it('coalesces filter input and resets the page without an extra request', async () => {
    const f = fixture()
    const options = ref({ page: 4, sortBy: 'name' })
    const filter = ref('')
    const stop = watchListRequests(options, () => filter.value, f.requests)
    try {
      filter.value = 'a'
      expect(options.value.page).toBe(1)
      await vi.advanceTimersByTimeAsync(200)
      filter.value = 'ab'
      await vi.advanceTimersByTimeAsync(249)
      expect(f.request).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(f.request).toHaveBeenCalledOnce()
      f.pending[0].resolve('ab')
      await vi.advanceTimersByTimeAsync(0)
      expect(f.apply).toHaveBeenCalledExactlyOnceWith('ab')
    } finally {
      stop()
      f.requests.dispose()
    }
  })

  it('loads navigation immediately and cancels any pending filter timer', async () => {
    const f = fixture()
    const options = ref({ page: 1, sortBy: 'name' })
    const stop = watchListRequests(options, () => '', f.requests)
    try {
      f.requests.schedule()
      options.value.page = 2
      expect(f.request).toHaveBeenCalledOnce()
      options.value.sortBy = 'updatedAt'
      expect(f.request).toHaveBeenCalledTimes(2)
      expect(f.pending[0].signal.aborted).toBe(true)
      await vi.advanceTimersByTimeAsync(250)
      expect(f.request).toHaveBeenCalledTimes(2)
    } finally {
      stop()
      f.requests.dispose()
    }
  })

  it('invalidates old results immediately while a new filter is still waiting', async () => {
    const f = fixture()
    const first = f.requests.load()
    f.requests.schedule()
    expect(f.pending[0].signal.aborted).toBe(true)
    f.pending[0].resolve('old')
    await first
    expect(f.apply).not.toHaveBeenCalled()
    expect(f.setLoading).not.toHaveBeenCalledWith(false)
    await vi.advanceTimersByTimeAsync(250)
    f.pending[1].resolve('new')
    await vi.advanceTimersByTimeAsync(0)
    expect(f.apply).toHaveBeenCalledExactlyOnceWith('new')
    expect(f.setLoading).toHaveBeenLastCalledWith(false)
  })

  it('keeps the newest result when older requests finish later', async () => {
    const f = fixture()
    const first = f.requests.load()
    const second = f.requests.load()
    f.pending[1].resolve('new')
    await second
    f.pending[0].resolve('old')
    await first
    expect(f.apply).toHaveBeenCalledExactlyOnceWith('new')
    expect(f.setLoading.mock.calls.filter(([loading]) => !loading)).toHaveLength(1)
  })

  it('reports only current errors and releases the loading state', async () => {
    const f = fixture()
    const first = f.requests.load()
    const second = f.requests.load()
    f.pending[0].reject(new Error('old'))
    await first
    expect(f.onError).not.toHaveBeenCalled()
    const error = new Error('current')
    f.pending[1].reject(error)
    await second
    expect(f.onError).toHaveBeenCalledExactlyOnceWith(error)
    expect(f.setLoading).toHaveBeenLastCalledWith(false)
  })

  it('does not update an unmounted list or start its pending requests', async () => {
    const f = fixture()
    const first = f.requests.load()
    f.requests.schedule()
    f.requests.dispose()
    f.pending[0].resolve('old')
    await first
    await vi.advanceTimersByTimeAsync(1000)
    await f.requests.load()
    f.requests.schedule()
    expect(f.request).toHaveBeenCalledOnce()
    expect(f.pending[0].signal.aborted).toBe(true)
    expect(f.apply).not.toHaveBeenCalled()
  })
})
