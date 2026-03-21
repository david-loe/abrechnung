import { registerSW } from 'virtual:pwa-register'

if (import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW: async (_swUrl: string, registration: ServiceWorkerRegistration | undefined) => {
      await registration?.update()
    },
    onRegisterError: (error: unknown) => {
      console.error('SW registration failed:', error)
    }
  })
}
