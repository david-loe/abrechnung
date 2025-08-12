/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'
import ENV from '@/env'
import { readRequestFromDB, storeRequestToDB } from '@/indexedDB'
import { logger } from '@/logger.js'
import { escapeRegExp } from '../common/scripts'

declare let self: ServiceWorkerGlobalScope

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const BACKEND_URL = ENV.VITE_BACKEND_URL
const FRONTEND_URL = ENV.VITE_FRONTEND_URL

// Routes denylist for SPA navigation
const denylist = []
if (BACKEND_URL.startsWith(FRONTEND_URL)) {
  const backendPath = escapeRegExp(BACKEND_URL.replace(FRONTEND_URL, ''))
  denylist.push(
    new RegExp(`^${backendPath}/auth`),
    new RegExp(`^${backendPath}.*/report(?:\\?|$)`),
    new RegExp(`^${backendPath}/upload`),
    new RegExp(`^${backendPath}/ip`),
    new RegExp(`^${backendPath}/docs`)
  )
}

// -----------------------------------------------------------------------------
// Install & Activate
// -----------------------------------------------------------------------------
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.skipWaiting()
clientsClaim()

// -----------------------------------------------------------------------------
// Default handler
// -----------------------------------------------------------------------------
setDefaultHandler(new NetworkOnly())

// -----------------------------------------------------------------------------
// Route registrations
// -----------------------------------------------------------------------------
// 1️⃣ HTML Navigation (Vue SPA)
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist }))

// 2️⃣ Static Assets
registerRoute(({ request }) => request.destination === 'font', new StaleWhileRevalidate({ cacheName: 'font-cache' }))
// 3️⃣ API Calls
registerRoute(
  ({ request }) => request.url.startsWith(BACKEND_URL) && !request.url.startsWith(`${BACKEND_URL}/auth`),
  networkFirstWithDBFallback,
  'GET'
)

// -----------------------------------------------------------------------------
// Handlers & Utilities
// -----------------------------------------------------------------------------
/**
 * NetworkFirst strategy with IndexedDB fallback for GET requests.
 */
async function networkFirstWithDBFallback({ request }: { request: Request }) {
  const url = request.url.replace(ENV.VITE_BACKEND_URL, '')
  try {
    const response = await fetch(request)
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      await storeRequestToDB(await response.clone().json(), url)
    }
    return response
  } catch {
    const dbEntry = await readRequestFromDB(url)
    if (dbEntry) {
      return new Response(JSON.stringify(dbEntry), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ error: 'offline', message: 'No data' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

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
