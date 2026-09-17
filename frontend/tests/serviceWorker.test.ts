import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const precacheAndRoute = vi.hoisted(() => vi.fn())
vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }))
vi.mock('workbox-precaching', () => ({ cleanupOutdatedCaches: vi.fn(), createHandlerBoundToURL: vi.fn(), precacheAndRoute }))
vi.mock('workbox-routing', () => ({ NavigationRoute: class {}, registerRoute: vi.fn(), setDefaultHandler: vi.fn() }))
vi.mock('workbox-strategies', () => ({ NetworkOnly: class {}, StaleWhileRevalidate: class {} }))

const addEventListener = vi.fn()
const skipWaiting = vi.fn()
const clients = { claim: vi.fn(), matchAll: vi.fn() }
const manifest = [{ url: 'index.html', revision: 'fixture' }]

beforeEach(() => {
  vi.resetModules()
  clients.claim.mockReset().mockResolvedValue(undefined)
  clients.matchAll.mockReset().mockResolvedValue([])
  vi.stubGlobal('__ABRECHNUNG_ENV__', undefined)
  vi.stubGlobal('atob', () => JSON.stringify({ backendUrl: 'http://app.test/api', frontendUrl: 'http://app.test' }))
  vi.stubGlobal('self', {
    location: new URL('http://app.test/sw.js'),
    registration: { scope: 'http://app.test/' },
    clients,
    addEventListener,
    skipWaiting,
    __WB_MANIFEST: manifest
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

function activateWorker() {
  const handler = addEventListener.mock.calls.find(([name]) => name === 'activate')?.[1]
  expect(handler).toBeDefined()
  const pending: Promise<unknown>[] = []
  handler({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) })
  return Promise.all(pending)
}

it('boots the production worker without the window runtime configuration', async () => {
  await import('../sw.js')
  expect(skipWaiting).toHaveBeenCalledOnce()
  expect(precacheAndRoute).toHaveBeenCalledWith(manifest)
  expect(addEventListener.mock.calls.map(([name]) => name)).toContain('push')
})

it('claims first-install pages without reloading them', async () => {
  const page = { url: 'http://app.test/login', navigate: vi.fn() }
  clients.claim.mockImplementationOnce(async () => {
    clients.matchAll.mockResolvedValue([page])
  })
  await import('../sw.js')
  await activateWorker()
  expect(clients.claim).toHaveBeenCalledOnce()
  expect(page.navigate).not.toHaveBeenCalled()
})

it('reloads existing app tabs after claim without blocking activation on navigation', async () => {
  const first = { url: 'http://app.test/user?tab=2', navigate: vi.fn(() => new Promise(() => {})) }
  const second = { url: 'http://app.test/login', navigate: vi.fn(() => new Promise(() => {})) }
  const backend = { url: 'http://app.test/api/docs', navigate: vi.fn() }
  const outsideScope = { url: 'blob:http://app.test/observer', navigate: vi.fn() }
  clients.matchAll.mockResolvedValue([first, second, backend, outsideScope])
  const claim = Promise.withResolvers<void>()
  clients.claim.mockReturnValue(claim.promise)
  await import('../sw.js')
  const activation = activateWorker()
  await vi.waitFor(() => expect(clients.claim).toHaveBeenCalledOnce())
  expect(first.navigate).not.toHaveBeenCalled()
  claim.resolve()
  await activation
  expect(first.navigate).toHaveBeenCalledExactlyOnceWith(first.url)
  expect(second.navigate).toHaveBeenCalledExactlyOnceWith(second.url)
  expect(backend.navigate).not.toHaveBeenCalled()
  expect(outsideScope.navigate).not.toHaveBeenCalled()
})

it('still reloads other tabs when a tab closes during activation', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const closed = { url: 'http://app.test/user', navigate: vi.fn().mockRejectedValue(new Error('Tab closed')) }
  const open = { url: 'http://app.test/login', navigate: vi.fn().mockResolvedValue(null) }
  clients.matchAll.mockResolvedValue([closed, open])
  await import('../sw.js')
  await activateWorker()
  expect(open.navigate).toHaveBeenCalledExactlyOnceWith(open.url)
})

it('forces a document reload before restoring the original query and fragment', async () => {
  const reloaded = { navigate: vi.fn().mockResolvedValue(null) }
  const page = { url: 'http://app.test/user?tab=2#details', navigate: vi.fn().mockResolvedValue(reloaded) }
  clients.matchAll.mockResolvedValue([page])
  await import('../sw.js')
  await activateWorker()
  expect(page.navigate).toHaveBeenCalledExactlyOnceWith('http://app.test/user?tab=2')
  expect(reloaded.navigate).toHaveBeenCalledExactlyOnceWith(page.url)
})
