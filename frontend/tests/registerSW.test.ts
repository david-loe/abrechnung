import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const update = vi.fn()
const register = vi.fn()
const reload = vi.fn()
let serviceWorker: EventTarget & { controller: object | null; register: typeof register }
let browserNavigator: { onLine: boolean; serviceWorker: typeof serviceWorker }

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('PROD', true)
  update.mockReset().mockResolvedValue(undefined)
  register.mockReset().mockResolvedValue({ update })
  reload.mockReset()
  vi.stubGlobal('window', { location: { reload } })
  serviceWorker = Object.assign(new EventTarget(), { controller: {} as object | null, register })
  browserNavigator = { onLine: true, serviceWorker }
  vi.stubGlobal('navigator', browserNavigator)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it('updates the existing root registration without consulting the HTTP cache', async () => {
  await import('../src/registerSW.js')
  expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js', { scope: '/', updateViaCache: 'none' })
  expect(update).toHaveBeenCalledOnce()
})

it('leaves initial and update navigation to the worker without a second page-side reload', async () => {
  serviceWorker.controller = null
  await import('../src/registerSW.js')
  serviceWorker.controller = {}
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  serviceWorker.controller = {}
  serviceWorker.dispatchEvent(new Event('controllerchange'))
  expect(reload).not.toHaveBeenCalled()
})

it('skips the update check when offline', async () => {
  browserNavigator.onLine = false
  await import('../src/registerSW.js')
  expect(register).toHaveBeenCalledOnce()
  expect(update).not.toHaveBeenCalled()
})

it('reports a failed update check without an unhandled rejection', async () => {
  const error = new Error('Network unavailable')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  update.mockRejectedValueOnce(error)
  await import('../src/registerSW.js')
  expect(log).toHaveBeenCalledExactlyOnceWith('SW update failed:', error)
})

it('reports registration failures without an unhandled rejection', async () => {
  const error = new Error('Registration failed')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  register.mockRejectedValueOnce(error)
  await import('../src/registerSW.js')
  expect(log).toHaveBeenCalledWith('SW registration failed:', error)
  expect(update).not.toHaveBeenCalled()
})

it('does not register in development or when service workers are unavailable', async () => {
  vi.stubEnv('PROD', false)
  await import('../src/registerSW.js')
  expect(register).not.toHaveBeenCalled()
  vi.resetModules()
  vi.stubEnv('PROD', true)
  vi.stubGlobal('navigator', { onLine: true })
  await import('../src/registerSW.js')
  expect(register).not.toHaveBeenCalled()
})
