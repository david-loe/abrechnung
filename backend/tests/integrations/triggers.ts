import test, { ExecutionContext } from 'ava'
import { runLumpSumsSchedule } from '../../integrations/lumpSums/integration.js'
import { closeIntegrationQueue, setIntegrationQueueForTests } from '../../integrations/queue.js'
import { runRetentionPolicySchedule } from '../../integrations/retentionPolicy/integration.js'
import { type IntegrationJobData } from '../../integrations/types.js'

function stubQueue(
  t: ExecutionContext,
  options: { existingJobState?: string; onAdd?: (name: string, data: IntegrationJobData, opts?: unknown) => Promise<unknown> } = {}
) {
  const removedStates: string[] = []
  setIntegrationQueueForTests({
    add: (options.onAdd ?? (async () => ({}) as never)) as never,
    close: async () => {},
    getJob: async () => {
      const existingJobState = options.existingJobState
      if (!existingJobState) {
        return undefined
      }

      return {
        getState: async () => existingJobState,
        remove: async () => {
          removedStates.push(existingJobState)
        }
      } as never
    }
  })
  t.teardown(() => {
    setIntegrationQueueForTests(undefined)
  })
  return { removedStates }
}

test.after.always(async () => {
  await closeIntegrationQueue()
})

test.serial('runLumpSumsSchedule skips enqueueing when the scheduled job is still active', async (t) => {
  let addCalls = 0
  stubQueue(t, {
    existingJobState: 'active',
    onAdd: async () => {
      addCalls += 1
      return {} as never
    }
  })

  await runLumpSumsSchedule()

  t.is(addCalls, 0)
})

test.serial('runLumpSumsSchedule removes terminal jobs before enqueueing a fresh run', async (t) => {
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined
  const { removedStates } = stubQueue(t, {
    existingJobState: 'completed',
    onAdd: async (name, data, opts) => {
      captured = { name, data, opts }
      return {} as never
    }
  })

  await runLumpSumsSchedule()

  t.deepEqual(removedStates, ['completed'])
  t.deepEqual(captured, {
    name: 'lumpSums.sync',
    data: { integrationKey: 'lumpSums', operation: 'sync', payload: {} },
    opts: { jobId: 'schedule:lumpSums:sync', removeOnComplete: true, removeOnFail: true }
  })
})

test.serial('runRetentionPolicySchedule skips enqueueing when the scheduled job is still waiting', async (t) => {
  let addCalls = 0
  stubQueue(t, {
    existingJobState: 'waiting',
    onAdd: async () => {
      addCalls += 1
      return {} as never
    }
  })

  await runRetentionPolicySchedule()

  t.is(addCalls, 0)
})

test.serial('runRetentionPolicySchedule removes terminal jobs before enqueueing a fresh run', async (t) => {
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined
  const { removedStates } = stubQueue(t, {
    existingJobState: 'failed',
    onAdd: async (name, data, opts) => {
      captured = { name, data, opts }
      return {} as never
    }
  })

  await runRetentionPolicySchedule()

  t.deepEqual(removedStates, ['failed'])
  t.deepEqual(captured, {
    name: 'retentionPolicy.apply',
    data: { integrationKey: 'retentionPolicy', operation: 'apply', payload: {} },
    opts: { jobId: 'schedule:retentionPolicy:apply', removeOnComplete: true, removeOnFail: true }
  })
})
