import fs from 'node:fs/promises'
import path from 'node:path'
import { Advance, ExpenseReport, HealthCareCost, Travel } from 'abrechnung-common/types.js'
import { Queue, Worker } from 'bullmq'
import { Types } from 'mongoose'
import { getConnectionSettings } from '../db.js'
import ENV from '../env.js'
import { reportPrinter } from '../factory.js'
import { logger } from '../logger.js'

export interface SaveReportOnDiskJobData {
  filePath: string
  report: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
}

const SAVE_REPORT_ON_DISK_QUEUE_NAME = 'saveReportOnDisk'

export const saveReportOnDiskQueue = new Queue<SaveReportOnDiskJobData>(SAVE_REPORT_ON_DISK_QUEUE_NAME, {
  connection: { url: ENV.REDIS_URL },
  defaultJobOptions: {
    attempts: 6,
    backoff: { type: 'exponential', delay: 3_000 },
    removeOnComplete: { count: 3 },
    removeOnFail: { count: 9 }
  }
})

export async function closeSaveReportOnDiskQueue() {
  await saveReportOnDiskQueue.close()
}

let workerInstance: Worker<SaveReportOnDiskJobData> | undefined

export function startSaveReportOnDiskWorker(concurrency = 1) {
  if (workerInstance) {
    return workerInstance
  }

  workerInstance = new Worker<SaveReportOnDiskJobData>(
    SAVE_REPORT_ON_DISK_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing saveReportOnDisk job ${job.id}`)
      const { filePath, report } = job.data
      const connectionSettings = await getConnectionSettings(false)
      const lng = connectionSettings.PDFReportsViaEmail.locale
      const pdf = await reportPrinter.print(report, lng)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      logger.debug(`Write to file ${filePath}`)
      await fs.writeFile(filePath, pdf)
    },
    { connection: { url: ENV.REDIS_URL }, concurrency }
  )

  workerInstance.on('completed', (job) => {
    logger.debug(`SaveReportOnDisk job ${job.id} completed`)
  })

  workerInstance.on('failed', (job, error) => {
    logger.error(`SaveReportOnDisk job ${job?.id} failed (${job?.data.filePath})`, error)
  })

  workerInstance.on('error', (error) => {
    logger.error('SaveReportOnDisk worker encountered an error', error)
  })

  logger.info('SaveReportOnDisk worker started')
  return workerInstance
}

export async function writeReportToDisk(
  filePath: string,
  report: Travel<Types.ObjectId> | ExpenseReport<Types.ObjectId> | HealthCareCost<Types.ObjectId> | Advance<Types.ObjectId>
): Promise<void> {
  await saveReportOnDiskQueue.add('writeReportToDisk', { filePath, report })
}
