/// <reference lib="webworker" />
import { RouteHandler } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'

declare var self: ServiceWorkerGlobalScope
export default {}
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      console.log('installevent triggerd')
      self.skipWaiting() // triggert direkt 'activate'
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      console.log('activated')
      self.clients.claim() // weiß nicht was genau das für einen unterschied macht
    })()
  )
})

// Ein benutzerdefiniertes Event für die Client-Seiten senden, wenn ein Update verfügbar ist
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

setDefaultHandler(new NetworkOnly())

// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

registerRoute(
  ({ request }) => request.destination === 'font',
  new NetworkFirst({
    cacheName: 'font-cache'
  })
)

//Callback Handler selbst geschrieben:
const DataToStore: RouteHandler = async ({ request }) => {
  console.log('RouteHandler triggered for:', request.url)
  let response = getDataFromStore(request)
  return response
}
registerRoute(({ request }) => /\/backend\/(?!auth\b).*/.test(request.url), DataToStore)

registerRoute(
  ({ request }) => /\/icons\/.*/.test(request.url),
  new StaleWhileRevalidate({
    cacheName: 'manifest-cache'
  })
)
registerRoute(
  ({ request }) => request.url.includes('/manifest'),
  new StaleWhileRevalidate({
    cacheName: 'manifest-cache'
  })
)

self.addEventListener('push', (event) => {
  console.log(event.data?.json(), Notification.permission)
  let notification = event.data?.json()
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      data: { url: notification.url }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const urlToOpen = event.notification.data.url
  console.log('open ' + event.notification.data.url)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const client = clientList.find((c) => c.url === urlToOpen && 'focus' in c)
      if (client) {
        return client.focus()
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })
  )
})

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('myDatabase', 1)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      db.createObjectStore('urls', { keyPath: 'id' })
    }

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result)
    }

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error)
    }
  })
}
async function storeResponse(url: string, response: Response) {
  const db = await openDatabase()
  const res = await response.json() // Antwortdaten verarbeiten
  const transaction = db.transaction('urls', 'readwrite')
  const store = transaction.objectStore('urls')
  store.put({ id: url, res })
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      console.log('data saved for' + url)
      resolve()
    }
    transaction.onerror = () => {
      reject('Problem')
    }
  })
}

async function getDataFromStore(request: Request) {
  let url = request.url.replace(import.meta.env.VITE_BACKEND_URL, '/backend')
  try {
    const networkResponse = await fetch(request)
    storeResponse(url, networkResponse.clone())
    return networkResponse
  } catch (error) {
    const db = await openDatabase()
    const transaction = db.transaction('urls', 'readonly')
    const store = transaction.objectStore('urls')
    const getRequest = store.get(url)
    return new Promise<Response>((resolve, reject) => {
      getRequest.onsuccess = () => {
        const cachedData = getRequest.result
        if (cachedData) {
          const cachedResponse = new Response(JSON.stringify(cachedData.res), {
            headers: { 'Content-Type': 'application/json' }
          })
          resolve(cachedResponse)
        } else {
          reject(new Error(`Keine gecachten Daten in IndexedDB verfügbar ${url}`))
        }
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }
}
