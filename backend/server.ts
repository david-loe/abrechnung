import APP, { shutdown } from './app.js'
import ENV from './env.js'
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

const server = app.listen(8000, () => {
  logger.info(`Backend listening at ${ENV.VITE_BACKEND_URL}`)
})

async function stop() {
  server.close()
  await shutdown()
}

process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())
