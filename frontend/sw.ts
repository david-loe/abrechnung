/// <reference lib="webworker" />
import { RouteHandler } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'

declare var self: ServiceWorkerGlobalScope
export default {}
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      self.skipWaiting()
    })()
  )
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      self.clients.claim()
    })()
  )
})
setDefaultHandler(new NetworkOnly())
// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

registerRoute(
  ({ request }) => request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'font-cache'
  })
)

const NetworkFirstToDB: RouteHandler = async ({ request }) => {
  let url = request.url.replace(import.meta.env.VITE_BACKEND_URL, '')
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
          reject(error)
        }
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }
}
registerRoute(({ request }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL
  const regex = new RegExp(`${backendUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(?!auth\\b).*`)
  return regex.test(request.url)
}, NetworkFirstToDB)

async function storeResponse(url: string, response: Response) {
  const db = await openDatabase()
  const res = await response.json()
  const transaction = db.transaction('urls', 'readwrite')
  const store = transaction.objectStore('urls')
  store.put({ id: url, res })
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onerror = () => {
      reject('Problem')
    }
  })
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('myDatabase', 1) // umbennenen und zentral speichern?

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
