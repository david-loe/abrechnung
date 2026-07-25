/// <reference lib="webworker" />

import { escapeRegExp } from 'abrechnung-common/utils/scripts.js'
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'
import {
  createRequestCacheKey,
  hasLogoutTombstone,
  purgePrivateData,
  readAuthContext,
  readRequestFromDB,
  storeRequestToDB
} from '@/indexedDB'
import { logger } from '@/logger.js'

declare let self: ServiceWorkerGlobalScope

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const IS_DEV_SERVICE_WORKER = self.location.pathname.endsWith('/dev-sw.js') || self.location.search.includes('dev-sw')
const EMBEDDED_RUNTIME_CONFIG = '__ABRECHNUNG_SW_CONFIG__'
const runtimeConfiguration = (
  IS_DEV_SERVICE_WORKER
    ? { backendUrl: import.meta.env.VITE_BACKEND_URL, frontendUrl: import.meta.env.VITE_FRONTEND_URL }
    : JSON.parse(atob(EMBEDDED_RUNTIME_CONFIG))
) as { backendUrl: string; frontendUrl: string }
const BACKEND_URL = runtimeConfiguration.backendUrl
const FRONTEND_URL = runtimeConfiguration.frontendUrl

// Routes denylist for SPA navigation
const denylist: RegExp[] = []
const configureNavigationDenylist = () => {
  const backend = new URL(BACKEND_URL)
  const frontend = new URL(FRONTEND_URL)
  if (backend.origin === frontend.origin) {
    denylist.length = 0
    const backendPath = escapeRegExp(backend.pathname.replace(/\/$/, ''))
    denylist.push(
      new RegExp(`^${backendPath}/auth`),
      new RegExp(`^${backendPath}.*/report(?:\\?|$)`),
      new RegExp(`^${backendPath}/upload`),
      new RegExp(`^${backendPath}/ip`),
      new RegExp(`^${backendPath}/docs`)
    )
  }
}
configureNavigationDenylist()

// -----------------------------------------------------------------------------
// Install & Activate
// -----------------------------------------------------------------------------
self.skipWaiting()
clientsClaim()

if (IS_DEV_SERVICE_WORKER) {
  self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))))
  })
} else {
  precacheAndRoute(self.__WB_MANIFEST)
  cleanupOutdatedCaches()
}

// -----------------------------------------------------------------------------
// Default handler
// -----------------------------------------------------------------------------
setDefaultHandler(new NetworkOnly())

// -----------------------------------------------------------------------------
// Route registrations
// -----------------------------------------------------------------------------
// 1️⃣ HTML Navigation (Vue SPA)
if (!IS_DEV_SERVICE_WORKER) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist }))
}

// 2️⃣ Static Assets
registerRoute(({ request }) => request.destination === 'font', new StaleWhileRevalidate({ cacheName: 'font-cache' }))
// 3️⃣ API Calls
registerRoute(({ request }) => request.destination === '', runtimeAwareGetHandler, 'GET')

// -----------------------------------------------------------------------------
// Handlers & Utilities
// -----------------------------------------------------------------------------
/**
 * NetworkFirst strategy with IndexedDB fallback for GET requests.
 */
async function networkFirstWithDBFallback({ request }: { request: Request }) {
  const context = await readAuthContext()
  const validContext = context && Date.parse(context.expiresAt) > Date.now() && !(await hasLogoutTombstone()) ? context : null
  const key = validContext ? createRequestCacheKey(request.url, validContext) : null
  try {
    const response = await fetch(request)
    if (response.status === 401 || response.status === 403) {
      await purgePrivateData()
      await notifyClientsToPurge()
    }
    if (validContext && key && response.ok && response.headers.get('content-type')?.includes('application/json')) {
      await storeRequestToDB(await response.clone().json(), key, validContext)
    }
    return response
  } catch {
    const dbEntry = validContext && key ? await readRequestFromDB(key, validContext) : null
    if (dbEntry) {
      return new Response(JSON.stringify(dbEntry), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'offline', message: 'No data' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function runtimeAwareGetHandler({ request }: { request: Request }) {
  if (isBackendRequest(request.url) && isOfflineCacheable(request.url)) return networkFirstWithDBFallback({ request })
  return fetch(request)
}

const bootstrapEndpoints = new Set([
  'user',
  'currency',
  'country',
  'settings',
  'travelSettings',
  'healthInsurance',
  'organisation',
  'category',
  'specialLumpSums',
  'displaySettings',
  'printerSettings',
  'project'
])
const ownReportEndpoints = new Set(['travel', 'expenseReport', 'healthCareCost', 'advance'])

function isOfflineCacheable(requestUrl: string) {
  const backend = new URL(BACKEND_URL)
  const url = new URL(requestUrl)
  if (!isBackendRequest(requestUrl)) return false
  const relativePath = url.pathname.slice(normalizedBackendPath(backend).length).replace(/^\//, '')
  const segments = relativePath.split('/').filter(Boolean)
  if (segments.length === 1 && bootstrapEndpoints.has(segments[0])) return true
  return segments.length <= 2 && ownReportEndpoints.has(segments[0]) && (segments.length === 1 || /^[0-9a-fA-F]{24}$/.test(segments[1]))
}

function normalizedBackendPath(backend: URL) {
  return backend.pathname.replace(/\/$/, '')
}

function isBackendRequest(requestUrl: string) {
  const backend = new URL(BACKEND_URL)
  const url = new URL(requestUrl)
  const backendPath = normalizedBackendPath(backend)
  return url.origin === backend.origin && (url.pathname === backendPath || url.pathname.startsWith(`${backendPath}/`))
}

async function notifyClientsToPurge() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const windowClient of windows) windowClient.postMessage('purge-private-data')
}

self.addEventListener('message', (event) => {
  if (event.data === 'purge-private-data') event.waitUntil(purgePrivateData())
})

// -----------------------------------------------------------------------------
// Push & Notification Events
// -----------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  const data = parsePushData(event)
  if (!data) return
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body || '', data: { url: data.url } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data.url
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => clients.find((c) => c.url === url)?.focus() || self.clients.openWindow(url))
  )
})

/**
 * Safely parse push event data or log error.
 */
function parsePushData(event: PushEvent) {
  try {
    const data = event.data?.json()
    if (data?.title && data?.url) return data
    throw new Error('Missing title or url')
  } catch (err) {
    logger.error('Invalid push data:', err)
    return null
  }
}
