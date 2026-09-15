import { afterEach, expect, it, vi } from 'vitest'

const precacheAndRoute = vi.hoisted(() => vi.fn())
vi.mock('workbox-core', () => ({ clientsClaim: vi.fn() }))
vi.mock('workbox-precaching', () => ({ cleanupOutdatedCaches: vi.fn(), createHandlerBoundToURL: vi.fn(), precacheAndRoute }))
vi.mock('workbox-routing', () => ({ NavigationRoute: class {}, registerRoute: vi.fn(), setDefaultHandler: vi.fn() }))
vi.mock('workbox-strategies', () => ({ NetworkOnly: class {}, StaleWhileRevalidate: class {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

it('boots the production worker without the window runtime configuration', async () => {
  vi.resetModules()
  vi.stubGlobal('__ABRECHNUNG_ENV__', undefined)
  vi.stubGlobal('atob', () => JSON.stringify({ backendUrl: 'http://api.test', frontendUrl: 'http://app.test' }))
  const addEventListener = vi.fn()
  const skipWaiting = vi.fn()
  const manifest = [{ url: 'index.html', revision: 'fixture' }]
  vi.stubGlobal('self', { location: new URL('http://app.test/sw.js'), addEventListener, skipWaiting, __WB_MANIFEST: manifest })
  await import('../sw.js')
  expect(skipWaiting).toHaveBeenCalledOnce()
  expect(precacheAndRoute).toHaveBeenCalledWith(manifest)
  expect(addEventListener.mock.calls.map(([name]) => name)).toContain('push')
})
