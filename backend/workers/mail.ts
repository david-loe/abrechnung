import { Queue, Worker } from 'bullmq'
import ENV from '../env.js'
import { logger } from '../logger.js'
import { MailRecipient, processMailJob } from '../notifications/mail.js'

export interface MailJobData {
  recipients: MailRecipient[]
  subject: string
  paragraph: string
  button?: { text: string; link: string }
  lastParagraph?: string | string[]
  authenticateLink: boolean
}

const MAIL_QUEUE_NAME = 'mail'

export const mailQueue = new Queue<MailJobData>(MAIL_QUEUE_NAME, {
  connection: { url: ENV.REDIS_URL },
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: true }
})

let workerInstance: Worker<MailJobData> | undefined

export function startMailWorker(concurrency = 5) {
  if (workerInstance) {
    return workerInstance
  }

  workerInstance = new Worker<MailJobData>(
    MAIL_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing mail job ${job.id}`)
      await processMailJob(job.data)
    },
    { connection: { url: ENV.REDIS_URL }, concurrency }
  )

  workerInstance.on('completed', (job) => {
    logger.debug(`Mail job ${job.id} completed`)
  })

  workerInstance.on('failed', (job, error) => {
    logger.error(`Mail job ${job?.id} failed`, error)
  })

  workerInstance.on('error', (error) => {
    logger.error('Mail worker encountered an error', error)
  })

  logger.info('Mail worker started')
  return workerInstance
}
