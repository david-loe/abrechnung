import 'fake-indexeddb/auto'

globalThis.__ABRECHNUNG_ENV__ = { MODE: 'development', VITE_FRONTEND_URL: 'http://frontend.test', VITE_BACKEND_URL: 'http://backend.test' }

const browserWindow = new EventTarget()
Object.defineProperties(globalThis, {
  window: { configurable: true, value: browserWindow },
  navigator: { configurable: true, value: { onLine: true, serviceWorker: undefined } },
  location: { configurable: true, value: new URL('http://frontend.test/') }
})
