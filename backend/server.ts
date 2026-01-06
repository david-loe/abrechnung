import { CronJob } from 'cron'
import APP from './app.js'
import { fetchAndUpdateLumpSums } from './db.js'
import ENV from './env.js'
import { logger } from './logger.js'
import { UserDoc } from './models/user.js'
import { retentionPolicy } from './retentionpolicy.js'

declare global {
  namespace Express {
    interface User extends UserDoc {}
    interface AuthInfo {
      redirect?: string
    }
  }
}

;(await APP()).listen(8000, () => {
  logger.info(`Backend listening at ${ENV.VITE_BACKEND_URL}`)
})

// Update lump sums every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: fetchAndUpdateLumpSums, start: true })
// Trigger automatic deletion and notification mails for upcoming deletions every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: retentionPolicy, start: true })
