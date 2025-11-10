import { CronJob } from 'cron'
import APP from './app.js'
import { fetchAndUpdateLumpSums } from './db.js'
import ENV from './env.js'
import { logger } from './logger.js'
import { UserDoc } from './models/user.js'
import { retentionPolicy } from './retentionpolicy.js'
import { startFileSystemWorker } from './workers/fileSystem.js'
import { startMailWorker } from './workers/mail.js'
import { startWebhookWorker } from './workers/webhook.js'

declare global {
  namespace Express {
    interface User extends UserDoc {}
    interface AuthInfo {
      redirect?: string
    }
  }
}

;(await APP()).listen(ENV.BACKEND_PORT, () => {
  logger.info(`Backend listening at ${ENV.VITE_BACKEND_URL}`)
})

startFileSystemWorker()
startMailWorker()
startWebhookWorker()

// Update lump sums every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: fetchAndUpdateLumpSums, start: true })
// Trigger automatic deletion and notification mails for upcoming deletions every day at 1 AM
CronJob.from({ cronTime: '0 1 * * *', onTick: retentionPolicy, start: true })
