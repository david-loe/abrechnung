import { runScheduledIntegrationJob } from '../runScheduledIntegrationJob.js'
import { runPolicyAction } from '../runtime.js'

const JOB_ID = 'schedule:retentionPolicy:apply'

export async function retentionPolicy() {
  await runScheduledIntegrationJob(JOB_ID, 'retention policy run', () =>
    runPolicyAction('retention.apply', {}, { jobId: JOB_ID, removeOnComplete: true, removeOnFail: true })
  )
}
