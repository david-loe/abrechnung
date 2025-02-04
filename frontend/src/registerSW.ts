if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register(import.meta.env.MODE === 'production' ? '/sw.js' : '/dev-sw.js?dev-sw', {
      type: import.meta.env.MODE === 'production' ? 'classic' : 'module'
    })
    .then((registration) => {
      registration.onupdatefound = () => {
        const newWorker = registration.installing
        if (!newWorker) {
          return
        }
        newWorker.onstatechange = () => {
          if (newWorker.state !== 'installed') {
            return
          }
          if (!navigator.serviceWorker.controller) {
            return
          }
          newWorker.onstatechange = () => {
            if (newWorker.state !== 'activated') {
              return
            }
            window.location.reload()
          }
        }
      }
    })
}
