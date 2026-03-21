import { logger } from '../../logger.js'
import { getIntegrationQueue, runPolicyAction } from '../runtime.js'

const JOB_ID = 'schedule:retentionPolicy:apply'
const NON_TERMINAL_STATES = ['active', 'waiting', 'delayed', 'prioritized', 'waiting-children']

export async function retentionPolicy() {
  const existingJob = await getIntegrationQueue().getJob(JOB_ID)
  if (existingJob) {
    const state = await existingJob.getState()
    if (NON_TERMINAL_STATES.includes(state)) {
      logger.info(`Skipping scheduled retention policy run because job '${JOB_ID}' is still ${state}.`)
      return
    }
    await existingJob.remove()
  }

  await runPolicyAction('retention.apply', {}, { jobId: JOB_ID, removeOnComplete: true, removeOnFail: true })
}
