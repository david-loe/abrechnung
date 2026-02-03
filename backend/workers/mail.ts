import { Contact, Locale } from 'abrechnung-common/types.js'
import { Queue, Worker } from 'bullmq'
import ENV from '../env.js'
import { logger } from '../logger.js'
import { sendMail } from '../notifications/mail.js'

export interface MailJobData {
  recipient: Contact
  subject: string
  paragraph: string
  language: Locale
  button?: { text: string; link: string }
  lastParagraph?: string | string[]
}

const MAIL_QUEUE_NAME = 'mail'

export const mailQueue = new Queue<MailJobData>(MAIL_QUEUE_NAME, {
  connection: { url: ENV.REDIS_URL },
  prefix: ENV.REDIS_PREFIX,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: { count: 3 },
    removeOnFail: { count: 9 }
  }
})

export async function closeMailQueue() {
  await mailQueue.close()
}

let workerInstance: Worker<MailJobData> | undefined

export function startMailWorker(concurrency = 5) {
  if (workerInstance) {
    return workerInstance
  }

  workerInstance = new Worker<MailJobData>(
    MAIL_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing mail job ${job.id}`)
      await sendMail(job.data.recipient, job.data.subject, job.data.paragraph, job.data.language, job.data.button, job.data.lastParagraph)
    },
    { connection: { url: ENV.REDIS_URL }, prefix: ENV.REDIS_PREFIX, concurrency }
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
