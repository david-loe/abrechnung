import { runScheduledIntegrationJob } from '../runScheduledIntegrationJob.js'
import { runInboundSync } from '../runtime.js'

const JOB_ID = 'schedule:lumpSums:sync'

export async function fetchAndUpdateLumpSums() {
  await runScheduledIntegrationJob(JOB_ID, 'lump sum sync', () =>
    runInboundSync('lump_sums.sync_in', {}, { jobId: JOB_ID, removeOnComplete: true, removeOnFail: true })
  )
}
