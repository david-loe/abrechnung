import APP from './app.js'
import ENV from './env.js'
import { startIntegrationScheduler } from './integrations/scheduler.js'
import { logger } from './logger.js'
import { UserDoc } from './models/user.js'

declare global {
  namespace Express {
    interface User extends UserDoc {}
    interface AuthInfo {
      redirect?: string
    }
  }
}

const app = await APP()
await startIntegrationScheduler()

app.listen(8000, () => {
  logger.info(`Backend listening at ${ENV.VITE_BACKEND_URL}`)
})
