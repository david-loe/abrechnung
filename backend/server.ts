import { CronJob } from 'cron'
import APP from './app.js'
import { fetchAndUpdateLumpSums } from './db.js'
import { logger } from './logger.js'
import { UserDoc } from './models/user.js'
import { retentionPolicy } from './retentionpolicy.js'
const port = Number.parseInt(process.env.BACKEND_PORT)
const url = process.env.VITE_BACKEND_URL

declare global {
  namespace Express {
    interface User extends UserDoc {}
    interface AuthInfo {
      redirect?: string
    }
  }
  namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV: 'development' | 'production'
      readonly ADMIN_UID: string
      readonly VITE_FRONTEND_URL: string
      readonly VITE_BACKEND_URL: string
      readonly COOKIE_SECRET: string
      readonly MAGIC_LOGIN_SECRET: string
      readonly BACKEND_PORT: string
      readonly MONGO_URL: string
      readonly BACKEND_SAVE_REPORTS_ON_DISK: 'TRUE' | 'FALSE'
      readonly VITE_PUBLIC_VAPID_KEY: string
      readonly PRIVATE_VAPID_KEY: string
      readonly VITE_MAX_FILE_SIZE: string
      readonly RATE_LIMIT_WINDOW_MS: string
      readonly RATE_LIMIT: string
      readonly TRUST_PROXY: string
      readonly LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
    }
  }
}

;(await APP()).listen(port, () => {
  logger.info(`Backend listening at ${url}`)
})

// Update lump sums every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: fetchAndUpdateLumpSums, start: true })
// Trigger automatic deletion and notification mails for upcoming deletions every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: retentionPolicy, start: true })
