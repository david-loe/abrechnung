/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
declare var self: ServiceWorkerGlobalScope
export default {}
precacheAndRoute(self.__WB_MANIFEST)
let cacheName = 'abrechnung' // hier könnte man eine versionierung ergänzen - eventuell nach app version?
// dann müsste man alle alten Caches aber auch aktiv löschen - würde aber sinn machen maybe
const reportTypeToFetch = ['healthCareCost', 'expenseReport', 'travel']

self.addEventListener('install', (event) => {
  console.log('installevent triggerd')
  self.skipWaiting() // direkt activate triggern
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // ausführen dieser Funktion ist quatschig, wenn der Service Worker nicht aktiviert wird, wenn der Nutzer schon eingeloggt ist
    // wird installiert, wenn die Seite geladen wird - da ist der Nutzer selten schon eingeloggt.
    (async () => {
      let urlsToCache = await fetchAndCacheUrls(reportTypeToFetch)
      // const cache = await caches.open(cacheName).then((cache) => {
      //   cache.addAll(urlsToCache)
      // })
      // new NetworkFirst({
      //   cacheName: cacheName
      // })
      let urlsToStore = addBackendRoutes(urlsToCache)
      await fetchAndStoreUrls(urlsToStore)
    })()
  )
  console.log('activated')
})

//brauch ich für verwendung vom Cache
//setDefaultHandler(new NetworkOnly())

// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

registerRoute(
  ({ request }) => request.destination === 'font',
  new NetworkFirst({
    cacheName: 'font-cache'
  })
)
// registerRoute(
//   ({ request }) => /\/backend\/.*/.test(request.url),
//   new NetworkFirst({
//     cacheName: cacheName
//   })
// )
registerRoute(
  ({ request }) => /\/icons\/.*/.test(request.url),
  new StaleWhileRevalidate({
    cacheName: 'manifest-cache'
  })
)
registerRoute(
  ({ request }) => request.url.includes('/manifest.json'),
  new StaleWhileRevalidate({
    cacheName: 'manifest-cache'
  })
)

self.addEventListener('push', (event) => {
  console.log(event.data?.json(), Notification.permission)
  let notification = event.data?.json()
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body
    })
  )
})

async function fetchAndCacheUrls(reportTypes: string[]) {
  let detailUrls: string[] = []
  for (let reportType of reportTypes) {
    let url = '/backend/' + reportType + '?limit=12'
    detailUrls.push(url)
    detailUrls.push('/backend/' + reportType + '/examiner')
    try {
      const response = await fetch(url) // Daten von der URL abrufen
      if (response.ok) {
        const res = await response.json() // Antwortdaten verarbeiten
        for (let i = 0; i < res.data.length; i++) {
          detailUrls.push(
            '/backend/' +
              reportType +
              '?_id=' +
              res.data[i]._id +
              (reportType == 'travel'
                ? '&additionalFields=stages&additionalFields=expenses&additionalFields=days'
                : '&additionalFields=expenses')
          )
        }
      }
    } catch (error) {
      console.error(`Fehler beim Abrufen der URL ${url}:`, error)
    }
  }
  return detailUrls
}

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

async function fetchAndStoreUrls(urls: string[]) {
  const db = await openDatabase()
  for (let i = 0; i < urls.length; i++) {
    try {
      const response = await fetch(urls[i]) // Daten von der URL abrufen
      if (response.ok) {
        const res = await response.json() // Antwortdaten verarbeiten
        const transaction = db.transaction('urls', 'readwrite')
        const store = transaction.objectStore('urls')
        store.put({ id: urls[i], res })
        await new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => {
            resolve()
          }
          transaction.onerror = (event) => {
            reject((event.target as IDBTransaction).error)
          }
        })
      }
    } catch (error) {
      console.error(`Fehler beim Abrufen der URL ${urls[i]}:`, error)
    }
  }
}

self.addEventListener('fetch', (event) => {
  event.respondWith(
    (async () => {
      console.log('fetch event used for: ' + event.request.url)
      const cachedResponse = await caches.match(event.request)

      if (cachedResponse) {
        // Falls eine gecachte Antwort gefunden wird, gebe sie zurück
        console.log('Serving from cache:', event.request.url)
        return cachedResponse
      }
      try {
        const networkResponse = await fetch(event.request)
        return networkResponse // hier fehlt noch - dass es dann gespeichert wird.
      } catch (error) {
        console.log(`Netzwerk fehlgeschlagen, verwende Fallback: ${event.request.url}`)
        let url = event.request.url.replace(import.meta.env.VITE_BACKEND_URL, '/backend')
        console.log(url)
        // Netzwerk fehlgeschlagen: Hole Daten aus IndexedDB
        const db = await openDatabase()
        const transaction = db.transaction('urls', 'readonly')
        const store = transaction.objectStore('urls')
        const getRequest = store.get(url)
        return new Promise<Response>((resolve, reject) => {
          getRequest.onsuccess = () => {
            console.log(getRequest)
            const cachedData = getRequest.result
            if (cachedData) {
              // console.log(cachedData.json())
              // Gecachte Antwort aus IndexedDB erstellen
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
    })()
  )
})
function addBackendRoutes(urlsToCache: string[]) {
  let urls = urlsToCache
  let urlsAdd = [
    '/backend/user',
    '/backend/currency',
    '/backend/country',
    '/backend/settings',
    '/backend/healthInsurance',
    '/backend/organisation',
    '/backend/project',
    '/backend/specialLumpSums',
    '/backend/users'
  ]
  for (let i = 0; i < urlsAdd.length; i++) {
    urls.push(urlsAdd[i])
  }
  return urls
}
