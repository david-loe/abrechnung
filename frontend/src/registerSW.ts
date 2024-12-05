if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((registration) => {
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
