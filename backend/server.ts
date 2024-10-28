import { CronJob } from 'cron'
import app from './app.js'
import { fetchAndUpdateLumpSums } from './db.js'
import { UserDoc } from './models/user.js'
import { retentionPolicy } from './retentionpolicy.js'
const port = parseInt(process.env.BACKEND_PORT)
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
      readonly VITE_MAX_FILE_SIZE: string
      readonly RATE_LIMIT_WINDOW_MS: string
      readonly RATE_LIMIT: string
      readonly TRUST_PROXY: string
    }
  }
}

app.listen(port, () => {
  console.log(`Backend listening at ${url}`)
})

// Update lump sums every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: fetchAndUpdateLumpSums, start: true })
// Trigger automatic deletion and notification mails for upcoming deletions every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: retentionPolicy, start: true })
