import { BACKEND_CACHE } from './db.js'
import ENV from './env.js'

let initializationPromise: Promise<void> | undefined
let heartbeatTimer: NodeJS.Timeout | undefined

export function initializeBackendRuntime(options: { synchronize?: boolean } = {}) {
  initializationPromise ??= (async () => {
    await BACKEND_CACHE.initialize(false)
    if (options.synchronize !== false) {
      await BACKEND_CACHE.initializeSynchronization(ENV.REDIS_URL, ENV.REDIS_PREFIX)
    }
  })().catch((error: unknown) => {
    initializationPromise = undefined
    throw error
  })
  return initializationPromise
}

export async function startWorkerHeartbeat() {
  if (heartbeatTimer) return
  await BACKEND_CACHE.publishWorkerHeartbeat()
  heartbeatTimer = setInterval(() => void BACKEND_CACHE.publishWorkerHeartbeat().catch(() => undefined), 10_000)
}

export function getRuntimeStatus() {
  return {
    config: BACKEND_CACHE.initialized ? ('ready' as const) : ('not_ready' as const),
    redis: BACKEND_CACHE.synchronizationReady ? ('ready' as const) : ('not_ready' as const)
  }
}

export async function shutdownBackendRuntime() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = undefined
  await BACKEND_CACHE.shutdown()
  initializationPromise = undefined
}
