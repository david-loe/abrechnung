import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createListRequests, watchListRequests } from '@/components/elements/listRequests.js'

function fixture() {
  const pending: { signal: AbortSignal; resolve: (value: string) => void; reject: (error: unknown) => void }[] = []
  const view = { data: '', loading: false, error: undefined as unknown }
  const request = (signal: AbortSignal) => new Promise<string>((resolve, reject) => pending.push({ signal, resolve, reject }))
  const requests = createListRequests({
    request,
    apply: (data) => {
      view.data = data
    },
    setLoading: (loading) => {
      view.loading = loading
    },
    onError: (error) => {
      view.error = error
    }
  })
  return { requests, pending, view }
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
      expect(f.pending).toHaveLength(0)
      await vi.advanceTimersByTimeAsync(1)
      expect(f.pending).toHaveLength(1)
      f.pending[0].resolve('ab')
      await vi.advanceTimersByTimeAsync(0)
      expect(f.view.data).toBe('ab')
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
      expect(f.pending).toHaveLength(1)
      options.value.sortBy = 'updatedAt'
      expect(f.pending).toHaveLength(2)
      expect(f.pending[0].signal.aborted).toBe(true)
      await vi.advanceTimersByTimeAsync(250)
      expect(f.pending).toHaveLength(2)
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
    expect(f.view.data).toBe('')
    expect(f.view.loading).toBe(true)
    await vi.advanceTimersByTimeAsync(250)
    f.pending[1].resolve('new')
    await vi.advanceTimersByTimeAsync(0)
    expect(f.view.data).toBe('new')
    expect(f.view.loading).toBe(false)
  })

  it('keeps the newest result when older requests finish later', async () => {
    const f = fixture()
    const first = f.requests.load()
    const second = f.requests.load()
    f.pending[1].resolve('new')
    await second
    f.pending[0].resolve('old')
    await first
    expect(f.view.data).toBe('new')
    expect(f.view.loading).toBe(false)
  })

  it('reports only current errors and releases the loading state', async () => {
    const f = fixture()
    const first = f.requests.load()
    const second = f.requests.load()
    f.pending[0].reject(new Error('old'))
    await first
    expect(f.view.error).toBeUndefined()
    const error = new Error('current')
    f.pending[1].reject(error)
    await second
    expect(f.view.error).toBe(error)
    expect(f.view.loading).toBe(false)
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
    expect(f.pending).toHaveLength(1)
    expect(f.pending[0].signal.aborted).toBe(true)
    expect(f.view.data).toBe('')
  })
})
