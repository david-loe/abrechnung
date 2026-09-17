if (import.meta.env.PROD && navigator.serviceWorker) {
  // Keep the URL and scope stable so this replaces existing registrations.
  // The worker reloads existing clients during activation.
  void navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(async (registration) => {
      if (!navigator.onLine) return
      try {
        await registration.update()
      } catch (error) {
        console.error('SW update failed:', error)
      }
    })
    .catch((error: unknown) => {
      console.error('SW registration failed:', error)
    })
}
