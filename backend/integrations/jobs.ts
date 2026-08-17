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
}

interface WorkerJobReference {
  id: string
  state: WorkerJobState
}

const JOB_NAME_SCAN_BATCH_SIZE = 100

function emptyWorkerJobCounts() {
  return Object.fromEntries(workerJobStates.map((jobState) => [jobState, 0])) as WorkerJobCounts
}

function countJobs(counts: WorkerJobCounts, state?: WorkerJobState) {
  return state ? counts[state] : Object.values(counts).reduce((sum, value) => sum + value, 0)
}

function buildWorkerJobsResponse(
  data: WorkerJobSummary[],
  counts: WorkerJobCounts,
  state: WorkerJobState | undefined,
  page: number,
  limit: number
) {
  const count = countJobs(counts, state)
  const meta: Meta = { count, page, limit, countPages: Math.ceil(count / limit) }
  return { data, meta, counts, jobNames: getIntegrationJobNames() }
}

async function getJobsByExactId(id: string, state: WorkerJobState | undefined, name: string | undefined, page: number, limit: number) {
  const queue = getIntegrationQueue()
  const counts = emptyWorkerJobCounts()
  const job = (await queue.getJob(id)) as IntegrationJob | undefined
  if (!job || (name && job.name !== name)) return buildWorkerJobsResponse([], counts, state, page, limit)

  const jobState = requireWorkerJobState(await job.getState())
  counts[jobState] = 1
  const data = page === 1 && (!state || state === jobState) ? [serializeSummary(job, jobState)] : []
  return buildWorkerJobsResponse(data, counts, state, page, limit)
}

async function getJobsByName(name: string, state: WorkerJobState | undefined, page: number, limit: number) {
  const queue = getIntegrationQueue()
  const client = await queue.client
  const counts = emptyWorkerJobCounts()
  const pageReferences: WorkerJobReference[] = []
  const start = (page - 1) * limit
  let matchingDataJobs = 0

  for (const jobState of workerJobStates) {
    let rangeStart = 0
    while (true) {
      const jobIds = await queue.getRanges([jobState], rangeStart, rangeStart + JOB_NAME_SCAN_BATCH_SIZE - 1)
      if (jobIds.length === 0) break

      // Avoid deserializing job payloads until the matching result page is known.
      const jobNames = await Promise.all(jobIds.map(async (jobId) => await client.hget(queue.toKey(jobId), 'name')))
      for (let index = 0; index < jobIds.length; index++) {
        if (jobNames[index] !== name) continue

        counts[jobState]++
        if (!state || state === jobState) {
          if (matchingDataJobs >= start && pageReferences.length < limit) {
            pageReferences.push({ id: jobIds[index], state: jobState })
          }
          matchingDataJobs++
        }
      }

      rangeStart += jobIds.length
      if (jobIds.length < JOB_NAME_SCAN_BATCH_SIZE) break
    }
  }

  const pageJobs = await Promise.all(
    pageReferences.map(async ({ id: jobId, state: jobState }) => ({ job: await queue.getJob(jobId), state: jobState }))
  )
  const data = pageJobs.flatMap(({ job, state: jobState }) => (job ? [serializeSummary(job as IntegrationJob, jobState)] : []))
  return buildWorkerJobsResponse(data, counts, state, page, limit)
}

async function getUnfilteredJobs(state: WorkerJobState | undefined, page: number, limit: number) {
  const queue = getIntegrationQueue()
  const rawCounts = await queue.getJobCounts(...workerJobStates)
  const counts = Object.fromEntries(workerJobStates.map((jobState) => [jobState, rawCounts[jobState] ?? 0])) as WorkerJobCounts
  const states = state ? [state] : [...workerJobStates]
  const data: WorkerJobSummary[] = []
  let jobsToSkip = (page - 1) * limit

  for (const jobState of states) {
    const stateCount = counts[jobState]
    if (jobsToSkip >= stateCount) {
      jobsToSkip -= stateCount
      continue
    }

    const jobsToLoad = Math.min(limit - data.length, stateCount - jobsToSkip)
    const jobs = await queue.getJobs([jobState], jobsToSkip, jobsToSkip + jobsToLoad - 1)
    data.push(...jobs.map((job) => serializeSummary(job as IntegrationJob, jobState)))
    jobsToSkip = 0
    if (data.length === limit) break
  }

  return buildWorkerJobsResponse(data, counts, state, page, limit)
}

export async function getWorkerJobs({ state, name, id, page, limit }: WorkerJobListOptions) {
  if (id) return await getJobsByExactId(id, state, name, page, limit)
  if (name) return await getJobsByName(name, state, page, limit)
  return await getUnfilteredJobs(state, page, limit)
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
