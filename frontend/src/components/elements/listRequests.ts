import { type Ref, watch } from 'vue'

interface ListRequestOptions<T> {
  request: (signal: AbortSignal) => Promise<T>
  apply: (result: T) => void
  setLoading: (loading: boolean) => void
  onError: (error: unknown) => void
}

/** Only the latest intent may update the list, including during the debounce delay. */
export function createListRequests<T>({ request, apply, setLoading, onError }: ListRequestOptions<T>) {
  let generation = 0
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function invalidate() {
    generation += 1
    clearTimeout(timer)
    timer = undefined
    controller?.abort()
    controller = undefined
    return generation
  }

  async function load() {
    if (disposed) return
    const current = invalidate()
    controller = new AbortController()
    setLoading(true)
    try {
      const result = await request(controller.signal)
      if (current === generation) apply(result)
    } catch (error) {
      if (current === generation) onError(error)
    } finally {
      if (current === generation) {
        controller = undefined
        setLoading(false)
      }
    }
  }

  function schedule() {
    if (disposed) return
    invalidate()
    setLoading(true)
    timer = setTimeout(() => void load(), 250)
  }

  function dispose() {
    disposed = true
    invalidate()
  }

  return { load, schedule, dispose }
}

export function watchListRequests<T extends { page: number }>(
  serverOptions: Ref<T>,
  filter: () => string,
  requests: ReturnType<typeof createListRequests>
) {
  let resettingPage = false
  const stopOptions = watch(
    serverOptions,
    () => {
      if (!resettingPage) void requests.load()
    },
    { deep: true, flush: 'sync' }
  )
  const stopFilter = watch(
    filter,
    () => {
      resettingPage = true
      serverOptions.value.page = 1
      resettingPage = false
      requests.schedule()
    },
    { flush: 'sync' }
  )
  return () => {
    stopOptions()
    stopFilter()
  }
}
