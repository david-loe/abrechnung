/// <reference lib="webworker" />
import { clientsClaim, RouteHandler } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies'

declare var self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

self.skipWaiting()
clientsClaim()

//default caching strategy - no caching only using network
setDefaultHandler(new NetworkOnly())
// to allow work offline - setting default entry point for app
const denylist = [/\/report(?:\?|$)/]
if (import.meta.env.VITE_BACKEND_URL.startsWith(import.meta.env.VITE_FRONTEND_URL)) {
  const backendPath = import.meta.env.VITE_BACKEND_URL.replace(import.meta.env.VITE_FRONTEND_URL, '')
  denylist.push(new RegExp(`^${backendPath}/auth`), new RegExp(`^${backendPath}/ip`), new RegExp(`^${backendPath}/docs`))
}
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist }))

//caching all fonts with StaleWhileRevalidat strategy
registerRoute(
  ({ request }) => request.destination === 'font',
  new StaleWhileRevalidate({
    cacheName: 'font-cache'
  })
)

//defining a Route Handler for NetworkForst strategy but saving the data in IndexedDB
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
        if (!cachedData) {
          reject(error)
        }
        const cachedResponse = new Response(JSON.stringify(cachedData.res), {
          headers: { 'Content-Type': 'application/json' }
        })
        resolve(cachedResponse)
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }
}
//register all Routes using the backend url for NetWorkFirstToDB RouteHandler
registerRoute(({ request }) => {
  const isBackendURLbutNotAuth =
    request.url.startsWith(import.meta.env.VITE_BACKEND_URL) && !request.url.startsWith(import.meta.env.VITE_BACKEND_URL + '/auth')
  return isBackendURLbutNotAuth
}, NetworkFirstToDB)

//saving data in indexedDB
async function storeResponse(url: string, response: Response) {
  const contentType = response.headers.get('content-type')
  if (contentType !== null && contentType.includes('application/json')) {
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

//reacting to push event and trigger display of notification
self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data?.json()
  } catch (e) {
    console.error('Push-Daten konnten nicht geparst werden:', e)
    return
  }
  // Überprüfe, ob alle nötigen Felder vorhanden sind
  if (!data || !data.title || !data.url) {
    console.error('Push-Daten unvollständig:', data)
    return
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || '',
      data: { url: data.url }
      // Hier können weitere Optionen wie Icons oder Aktionen ergänzt werden
    })
  )
})

//reacting to notificationclick event and open the notification url
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
