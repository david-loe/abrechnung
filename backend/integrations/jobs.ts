import { Meta, WorkerJobCounts, WorkerJobDetails, WorkerJobState, WorkerJobSummary, workerJobStates } from 'abrechnung-common/types.js'
import { Job } from 'bullmq'
import { ConflictError, NotFoundError } from '../controller/error.js'
import { getIntegrationQueue, IntegrationJobData } from './queue.js'

type IntegrationJob = Job<IntegrationJobData, unknown>

function isWorkerJobState(state: string): state is WorkerJobState {
  return workerJobStates.includes(state as WorkerJobState)
}

function requireWorkerJobState(state: string) {
  if (!isWorkerJobState(state)) {
    throw new ConflictError(`Worker job is in unsupported state '${state}'.`)
  }
  return state
}

function serializeSummary(job: IntegrationJob, state: WorkerJobState): WorkerJobSummary {
  return {
    id: job.id ?? '',
    name: job.name,
    integrationKey: job.data.integrationKey,
    operation: job.data.operation,
    state,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    attemptsMade: job.attemptsMade,
    attempts: job.opts.attempts ?? 1
  }
}

export async function getWorkerJobs(state: WorkerJobState | undefined, page: number, limit: number) {
  const queue = getIntegrationQueue()
  const states = state ? [state] : [...workerJobStates]
  const start = (page - 1) * limit
  const [jobs, rawCounts] = await Promise.all([queue.getJobs(states, start, start + limit - 1), queue.getJobCounts(...workerJobStates)])
  const counts = Object.fromEntries(workerJobStates.map((jobState) => [jobState, rawCounts[jobState] ?? 0])) as WorkerJobCounts
  const count = state ? counts[state] : Object.values(counts).reduce((sum, value) => sum + value, 0)
  const data = await Promise.all(jobs.map(async (job) => serializeSummary(job, requireWorkerJobState(await job.getState()))))
  const meta: Meta = { count, page, limit, countPages: Math.ceil(count / limit) }

  return { data, meta, counts }
}

async function requireWorkerJob(jobId: string) {
  const job = await getIntegrationQueue().getJob(jobId)
  if (!job) throw new NotFoundError(`Worker job '${jobId}' was not found.`)
  return job
}

export async function getWorkerJob(jobId: string): Promise<{ data: WorkerJobDetails }> {
  const job = await requireWorkerJob(jobId)
  const state = requireWorkerJobState(await job.getState())
  return {
    data: {
      ...serializeSummary(job, state),
      payload: job.data.payload,
      result: job.returnvalue ?? null,
      failedReason: job.failedReason || undefined,
      stacktrace: job.stacktrace ?? []
    }
  }
}

export async function retryWorkerJob(jobId: string) {
  const job = await requireWorkerJob(jobId)
  const state = await job.getState()
  if (state !== 'failed') throw new ConflictError(`Only failed worker jobs can be retried; current state is '${state}'.`)

  await job.retry('failed', { resetAttemptsMade: true, resetAttemptsStarted: true })
  return serializeSummary(job, 'waiting')
}
