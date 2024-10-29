/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'
declare var self: ServiceWorkerGlobalScope
export default {}
precacheAndRoute(self.__WB_MANIFEST)
let cacheName = 'abrechnung'
const reportTypeToFetch = ['healthCareCost', 'expenseReport', 'travel']

self.addEventListener('install', (event) => {
  console.log('installevent triggerd')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('activate event triggerd')
  event.waitUntil(
    (async () => {
      let urlsToCache = await fetchAndCacheUrls(reportTypeToFetch)
      const cache = await caches.open(cacheName).then((cache) => {
        cache.addAll(urlsToCache)
      })
      new NetworkFirst({
        cacheName: cacheName
      })
    })()
  )
  console.log('activated')
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
registerRoute(
  ({ request }) => /\/backend\/.*/.test(request.url),
  new NetworkFirst({
    cacheName: cacheName
  })
)
registerRoute(
  ({ request }) => request.url.includes('/manifest.json'),
  new NetworkFirst({
    cacheName: 'manifest-cache'
  })
)

// self.addEventListener('fetch', (event) => {
//   event.respondWith(
//     //das soll network first sein.
//     fetch(event.request)
//       .then((networkResponse) => {
//         // Wenn die Netzwerkanfrage erfolgreich ist, wird die Antwort im Cache gespeichert
//         return caches.open(cacheName).then((cache) => {
//           // Speichere die Antwort im Cache für zukünftige Anfragen
//           cache.put(event.request, networkResponse.clone())
//           return networkResponse // Gib die Netzwerkantwort zurück
//         })
//       })
//       .catch(() => {
//         // Falls die Netzwerkanfrage fehlschlägt, versuche die Antwort aus dem Cache zu holen
//         return caches.match(event.request).then((cachedResponse) => {
//           if (cachedResponse) {
//             console.log('cached response')
//             return cachedResponse // Gib die gecachte Antwort zurück
//           }
//           // Optional: Fallback falls keine gecachte Antwort vorhanden ist
//           return new Response('Offline und keine Daten im Cache verfügbar.', { status: 504 })
//         })
//       })
//   )

//   // Hier prüfen wir, ob die Anfrage zu einer der gecachten Routen gehört
//   // event.respondWith(
//   //   caches.open(cacheName).then((cache) => {
//   //     return cache.keys().then((keys) => {
//   //       // console.log('Cached keys:', keys)
//   //       return cache.match(event.request).then((cachedResponse) => {
//   //         if (cachedResponse) {
//   //           console.log('Cache response')
//   //           // Wenn die Antwort im Cache ist, gib sie sofort zurück
//   //           return cachedResponse
//   //         }
//   //         console.log('Network Response')
//   //         console.log(event.request)
//   //         // Wenn die Antwort nicht im Cache ist, hole sie vom Netzwerk
//   //         return fetch(event.request)
//   //       })
//   //       // .then((networkResponse) => {
//   //       //   // Die neue Antwort kann ebenfalls im Cache gespeichert werden (optional)
//   //       //   // return caches.open(cacheName).then((cache) => {
//   //       //   //   cache.put(event.request, networkResponse.clone()) // Klonen, da der Response-Stream nur einmal gelesen werden kann
//   //       //   return networkResponse // Netzwerkantwort zurückgeben
//   //       // })
//   //     })
//   //   })
//   //   //   })
//   // )
// })

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

// // Route für travel, um die IDs bei der ersten Anfrage zu cachen
// registerRoute(
//   ({ request }) => /\/backend\/travel\?limit=/.test(request.url),
//   async (params) => {
//     const response = await fetch(params.request) // Initiale Travel-Anfrage
//     const data = await response.json() // Antwort parsen

//     // Sofortige Rückgabe der initialen Antwort
//     const clonedResponse = response.clone()

//     // IDs extrahieren und für jede ID eine Anfrage absetzen
//     const travelRequests = data.travels.map(async (travel: { id: any }) => {
//       try {
//         const travelResponse = await fetch(`/backend/travel?id=${travel.id}&additionalFields=expenses&additionalFields=days`)

//         if (!travelResponse.ok) {
//           throw new Error(`Error fetching travel details for ID ${travel.id}: ${travelResponse.status}`)
//         }

//         // Klone den Response, da wir ihn nicht direkt cachen können
//         const travelResponseClone = travelResponse.clone()

//         // Jedes travelDetail im Cache speichern
//         const travelCache = await caches.open('backend-cache')
//         await travelCache.put(travelResponseClone.url, travelResponseClone)
//       } catch (error) {
//         console.error(error)
//       }
//     })

//     // Warte auf alle zusätzlichen Anfragen
//     await Promise.all(travelRequests)

//     return clonedResponse // Die Hauptantwort zurückgeben
//   }
// )

// self.addEventListener('fetch', (event) => {
//   // Prüfen, ob die angeforderte URL die von dir gewünschte API ist
//   if (event.request.url.includes('/backend/travel')) {
//     console.log('travel getter abgefangen')
//     event.respondWith(fetch(event.request))
//   }
// })

// self.addEventListener('fetch', (event) => {
//   console.log('sw weiterleitung genutzt')
//   event.respondWith(fetch(event.request))
// })
// self.addEventListener('message', (event) => {
//   if (event.data && event.data.type === 'cacheTravelDetails') {
//     const travelId = event.data.travelId
//     const response = event.data.response

//     // Öffne den Cache und speichere die Antwort für die Travel-Details
//     caches.open('travel-details-cache').then((cache) => {
//       cache.put(`/backend/travel?_id=${travelId}&additionalFields=stages&additionalFields=expenses&additionalFields=days`, response)
//       console.log(`Cached travel details for travel ID: ${travelId}`)
//     })
//   }
// })

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

// aktuell geht die Funktion davon aus, dass die URL auf jeden fall limit enthält und reportTypes abfragt, zu denen mehr gesucht werden
async function fetchAndStoreUrl(url: string) {
  const db = await openDatabase()
  try {
    const response = await fetch(url) // Daten von der URL abrufen
    if (response.ok) {
      const res = await response.json() // Antwortdaten verarbeiten
      const transaction = db.transaction('urls', 'readwrite')
      const store = transaction.objectStore('urls')
      store.put({ id: url, res })
      const shortenedUrl = url.replace(/\?limit=\d+/, '').replace('/backend/', '')
      let reportType: 'travel' | 'expenseReport' | 'healthCareCost' | null = null
      if (shortenedUrl == 'travel') {
        reportType = 'travel'
      } else if (shortenedUrl == 'expenseReport') {
        reportType = 'expenseReport'
      } else if (shortenedUrl == 'healthCareCost') {
        reportType = 'healthCareCost'
      }
      console.log(res.data)
      for (let i = 0; i < res.data.length; i++) {
        console.log(res.data[i]._id + ' ' + reportType)
        await fetchDetail(reportType, res.data[i]._id)
      }
      // Speichern in der IndexedDB
      // Füge das Objekt in die IndexedDB ein

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => {
          resolve()
        }
        transaction.onerror = (event) => {
          reject((event.target as IDBTransaction).error)
        }
      })
    }
  } catch (error) {
    console.error(`Fehler beim Abrufen der URL ${url}:`, error)
  }
}
async function fetchDetail(reportType: 'travel' | 'expenseReport' | 'healthCareCost' | null, id: string) {
  if (reportType != null) {
    const db = await openDatabase()
    let url =
      '/backend/' +
      reportType +
      '?id=' +
      id +
      (reportType == 'travel' ? '&additionalFields=stages&additionalFields=expenses&additionalFields=days' : '&additionalFields=expenses')
    console.log(url)
    try {
      const response = await fetch(url) // Daten von der URL abrufen
      if (response.ok) {
        const res = await response.json() // Antwortdaten verarbeiten
        const transaction = db.transaction('urls', 'readwrite')
        const store = transaction.objectStore('urls')
        store.put({ id: url, res })

        return new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => {
            resolve()
          }
          transaction.onerror = (event) => {
            reject((event.target as IDBTransaction).error)
          }
        })
      }
    } catch (error) {
      console.error(`Fehler beim Abrufen der URL ${url}:`, error)
    }
  }
}
