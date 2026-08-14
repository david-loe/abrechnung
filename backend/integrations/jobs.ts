import { Meta, WorkerJobCounts, WorkerJobDetails, WorkerJobState, WorkerJobSummary, workerJobStates } from 'abrechnung-common/types.js'
import { Job } from 'bullmq'
import { ConflictError, NotFoundError } from '../controller/error.js'
import { getIntegrationQueue, IntegrationJobData } from './queue.js'
import { getIntegrationJobNames } from './registry.js'

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

interface WorkerJobListOptions {
  state?: WorkerJobState
  name?: string
  id?: string
  page: number
  limit: number
  sortDirection: 'asc' | 'desc'
}

export async function getWorkerJobs({ state, name, id, page, limit, sortDirection }: WorkerJobListOptions) {
  const queue = getIntegrationQueue()
  const jobsByState = await Promise.all(
    workerJobStates.map(async (jobState) => ({ state: jobState, jobs: await queue.getJobs([jobState], 0, -1) }))
  )
  const jobsWithState = jobsByState.flatMap(({ state: jobState, jobs }) =>
    jobs.map((job) => ({ job: job as IntegrationJob, state: jobState }))
  )
  const jobsMatchingName = name ? jobsWithState.filter(({ job }) => job.name === name) : jobsWithState
  const normalizedId = id?.toLowerCase()
  const jobsMatchingId = normalizedId
    ? jobsMatchingName.filter(({ job }) => job.id?.toLowerCase().includes(normalizedId))
    : jobsMatchingName
  const counts = Object.fromEntries(
    workerJobStates.map((jobState) => [jobState, jobsMatchingId.filter(({ state: currentState }) => currentState === jobState).length])
  ) as WorkerJobCounts
  const matchingJobs = state ? jobsMatchingId.filter(({ state: currentState }) => currentState === state) : jobsMatchingId
  const direction = sortDirection === 'asc' ? 1 : -1

  matchingJobs.sort(({ job: firstJob }, { job: secondJob }) => {
    const timestampComparison = firstJob.timestamp - secondJob.timestamp
    if (timestampComparison !== 0) return timestampComparison * direction
    return (firstJob.id ?? '').localeCompare(secondJob.id ?? '') * direction
  })

  const start = (page - 1) * limit
  const count = matchingJobs.length
  const data = matchingJobs.slice(start, start + limit).map(({ job, state: jobState }) => serializeSummary(job, jobState))
  const meta: Meta = { count, page, limit, countPages: Math.ceil(count / limit) }

  return { data, meta, counts, jobNames: getIntegrationJobNames() }
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
