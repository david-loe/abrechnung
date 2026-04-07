import { connectDB } from '../db.js'
import { syncIntegrationSchedules } from '../integrations/scheduler.js'
import { startIntegrationWorker } from '../integrations/worker.js'

await connectDB(false)
await syncIntegrationSchedules()
await startIntegrationWorker()
