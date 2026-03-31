import { logger } from '../logger.js'
import { getIntegrationQueue } from './queue.js'

const NON_TERMINAL_STATES = ['active', 'waiting', 'delayed', 'prioritized', 'waiting-children']

export async function runScheduledIntegrationJob(jobId: string, description: string, enqueue: () => Promise<void>) {
  const existingJob = await getIntegrationQueue().getJob(jobId)
  if (existingJob) {
    const state = await existingJob.getState()
    if (NON_TERMINAL_STATES.includes(state)) {
      logger.info(`Skipping scheduled ${description} because job '${jobId}' is still ${state}.`)
      return
    }
    await existingJob.remove()
  }

  await enqueue()
}
