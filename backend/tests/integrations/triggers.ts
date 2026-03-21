import test, { ExecutionContext } from 'ava'
import { fetchAndUpdateLumpSums } from '../../integrations/lumpSums/trigger.js'
import { retentionPolicy } from '../../integrations/policies/trigger.js'
import { closeIntegrationQueue, setIntegrationQueueForTests } from '../../integrations/runtime.js'
import { type IntegrationJobData } from '../../integrations/types.js'

function stubQueue(
  t: ExecutionContext,
  options: { existingJobState?: string; onAdd?: (name: string, data: IntegrationJobData, opts?: unknown) => Promise<unknown> } = {}
) {
  const removedStates: string[] = []
  setIntegrationQueueForTests({
    add: (options.onAdd ?? (async () => ({}) as never)) as never,
    close: async () => {},
    getJob: async () =>
      options.existingJobState
        ? ({
            getState: async () => options.existingJobState!,
            remove: async () => {
              removedStates.push(options.existingJobState!)
            }
          } as never)
        : undefined
  })
  t.teardown(() => {
    setIntegrationQueueForTests(undefined)
  })
  return { removedStates }
}

test.after.always(async () => {
  await closeIntegrationQueue()
})

test.serial('fetchAndUpdateLumpSums skips enqueueing when the scheduled job is still active', async (t) => {
  let addCalls = 0
  stubQueue(t, {
    existingJobState: 'active',
    onAdd: async () => {
      addCalls += 1
      return {} as never
    }
  })

  await fetchAndUpdateLumpSums()

  t.is(addCalls, 0)
})

test.serial('fetchAndUpdateLumpSums removes terminal jobs before enqueueing a fresh run', async (t) => {
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined
  const { removedStates } = stubQueue(t, {
    existingJobState: 'completed',
    onAdd: async (name, data, opts) => {
      captured = { name, data, opts }
      return {} as never
    }
  })

  await fetchAndUpdateLumpSums()

  t.deepEqual(removedStates, ['completed'])
  t.deepEqual(captured, {
    name: 'lump_sums.sync_in',
    data: { contract: 'inboundSync', action: 'lump_sums.sync_in', payload: {} },
    opts: { jobId: 'schedule:lumpSums:sync', removeOnComplete: true, removeOnFail: true }
  })
})

test.serial('retentionPolicy skips enqueueing when the scheduled job is still waiting', async (t) => {
  let addCalls = 0
  stubQueue(t, {
    existingJobState: 'waiting',
    onAdd: async () => {
      addCalls += 1
      return {} as never
    }
  })

  await retentionPolicy()

  t.is(addCalls, 0)
})

test.serial('retentionPolicy removes terminal jobs before enqueueing a fresh run', async (t) => {
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined
  const { removedStates } = stubQueue(t, {
    existingJobState: 'failed',
    onAdd: async (name, data, opts) => {
      captured = { name, data, opts }
      return {} as never
    }
  })

  await retentionPolicy()

  t.deepEqual(removedStates, ['failed'])
  t.deepEqual(captured, {
    name: 'retention.apply',
    data: { contract: 'policy', action: 'retention.apply', payload: {} },
    opts: { jobId: 'schedule:retentionPolicy:apply', removeOnComplete: true, removeOnFail: true }
  })
})
