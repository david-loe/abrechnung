if ('serviceWorker' in navigator) {
  const isProductionMode = import.meta.env.MODE === 'production'
  const swUrl = isProductionMode ? '/sw.js' : '/dev-sw.js?dev-sw'
  const swType = isProductionMode ? 'classic' : 'module'

  navigator.serviceWorker
    .register(swUrl, { type: swType, updateViaCache: 'imports' })
    .then(async (registration) => {
      // Gleich nach der Registration eine Update-Prüfung anstoßen
      await registration.update()

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🆕 Neuer Service Worker aktiv!')
        window.location.reload()
      })
    })
    .catch((err) => console.error('SW-Registration fehlgeschlagen:', err))
}
