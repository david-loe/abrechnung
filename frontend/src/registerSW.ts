if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    registration.onupdatefound = () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.onstatechange = () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // const updateBanner = document.getElementById('update-banner')
              // updateBanner?.removeAttribute('hidden')
              newWorker.onstatechange = () => {
                if (newWorker.state === 'activated') {
                  window.location.reload()
                }
              }
            }
          }
        }
      }
    }
  })
}
