import fs from 'node:fs/promises'
import path from 'node:path'
import { Queue, Worker } from 'bullmq'
import ENV from '../env.js'
import { logger } from '../logger.js'

export interface FileSystemJobData {
  filePath: string
  data: string | NodeJS.ArrayBufferView | Iterable<string | NodeJS.ArrayBufferView> | AsyncIterable<string | NodeJS.ArrayBufferView>
}

const FILESYSTEM_QUEUE_NAME = 'fileSystem'

export const fileSystemQueue = new Queue<FileSystemJobData>(FILESYSTEM_QUEUE_NAME, {
  connection: { url: ENV.REDIS_URL },
  defaultJobOptions: {
    attempts: 6,
    backoff: { type: 'exponential', delay: 3_000 },
    removeOnComplete: { count: 3 },
    removeOnFail: { count: 9 }
  }
})

let workerInstance: Worker<FileSystemJobData> | undefined

export function startFileSystemWorker(concurrency = 1) {
  if (workerInstance) {
    return workerInstance
  }

  workerInstance = new Worker<FileSystemJobData>(
    FILESYSTEM_QUEUE_NAME,
    async (job) => {
      logger.debug(`Processing fileSystem job ${job.id}`)
      await fs.mkdir(path.dirname(job.data.filePath), { recursive: true })
      logger.debug(`Write to file ${job.data.filePath}`)
      await fs.writeFile(job.data.filePath, job.data.data)
    },
    { connection: { url: ENV.REDIS_URL }, concurrency }
  )

  workerInstance.on('completed', (job) => {
    logger.debug(`FileSystem job ${job.id} completed`)
  })

  workerInstance.on('failed', (job, error) => {
    logger.error(`FileSystem job ${job?.id} failed (${job?.data.filePath})`, error)
  })

  workerInstance.on('error', (error) => {
    logger.error('FileSystem worker encountered an error', error)
  })

  logger.info('FileSystem worker started')
  return workerInstance
}
