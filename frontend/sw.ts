/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies'

declare var self: ServiceWorkerGlobalScope
export default {}
precacheAndRoute(self.__WB_MANIFEST)
let cacheName = 'abrechnung'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName).then((cache) => cache.addAll(['user', 'backend/user']))
      // Setting {cache: 'reload'} in the new request will ensure that the response
      // isn't fulfilled from the HTTP cache; i.e., it will be from the network.
      // await cache.put(new Request('/backend/settings'), await fetch('/backend/settings'))
      console.log('installevent triggerd')
    })()
  )
})
setDefaultHandler(new NetworkOnly())
// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'font-cache'
  })
)
registerRoute(
  ({ request }) => /\/backend\/.*/.test(request.url),
  new NetworkFirst({
    cacheName: 'backend-cache'
  })
)

self.addEventListener('fetch', (event) => {
  console.log('sw weiterleitung genutzt')
  event.respondWith(fetch(event.request))
})
