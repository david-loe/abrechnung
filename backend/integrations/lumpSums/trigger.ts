import { logger } from '../../logger.js'
import { getIntegrationQueue, runInboundSync } from '../runtime.js'

const JOB_ID = 'schedule:lumpSums:sync'
const NON_TERMINAL_STATES = ['active', 'waiting', 'delayed', 'prioritized', 'waiting-children']

export async function fetchAndUpdateLumpSums() {
  const existingJob = await getIntegrationQueue().getJob(JOB_ID)
  if (existingJob) {
    const state = await existingJob.getState()
    if (NON_TERMINAL_STATES.includes(state)) {
      logger.info(`Skipping scheduled lump sum sync because job '${JOB_ID}' is still ${state}.`)
      return
    }
    await existingJob.remove()
  }

  await runInboundSync('lump_sums.sync_in', {}, { jobId: JOB_ID, removeOnComplete: true, removeOnFail: true })
}
