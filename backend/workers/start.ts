import { BACKEND_CACHE, connectDB, disconnectDB } from '../db.js'
import { syncIntegrationSchedules } from '../integrations/scheduler.js'
import { closeIntegrationWorker, startIntegrationWorker } from '../integrations/worker.js'
import { initializeBackendRuntime, shutdownBackendRuntime, startWorkerHeartbeat } from '../runtime.js'

await connectDB(false)
await initializeBackendRuntime()
await syncIntegrationSchedules()
const worker = await startIntegrationWorker()
BACKEND_CACHE.onReadiness((ready) => void (ready ? worker.resume() : worker.pause()))
await startWorkerHeartbeat()

async function stop() {
  await closeIntegrationWorker()
  await shutdownBackendRuntime()
  await disconnectDB()
}

process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())
