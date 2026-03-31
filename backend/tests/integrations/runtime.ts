import test, { ExecutionContext } from 'ava'
import { Integration } from '../../integrations/integration.js'
import { processIntegrationJob } from '../../integrations/processor.js'
import { closeIntegrationQueue, setIntegrationQueueForTests } from '../../integrations/queue.js'
import { type IntegrationJobData } from '../../integrations/types.js'

function stubQueueAdd(t: ExecutionContext, implementation: (name: string, data: IntegrationJobData, opts?: unknown) => Promise<unknown>) {
  setIntegrationQueueForTests({ add: implementation as never, close: async () => {}, getJob: async () => undefined })
  t.teardown(() => {
    setIntegrationQueueForTests(undefined)
  })
}

test.after.always(async () => {
  await closeIntegrationQueue()
})

test.serial('Integration.enqueue applies integration-specific job options', async (t) => {
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined

  class QueueingIntegration extends Integration {
    public constructor() {
      super('stub')
    }

    protected override getJobOptions(operation: string) {
      if (operation === 'send') {
        return { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } }
      }

      return super.getJobOptions(operation)
    }
  }

  stubQueueAdd(t, async (name, data, opts) => {
    captured = { name, data, opts }
    return {} as never
  })

  await new QueueingIntegration().enqueue('send', { ok: true })

  t.deepEqual(captured, {
    name: 'stub.send',
    data: { integrationKey: 'stub', operation: 'send', payload: { ok: true } },
    opts: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } }
  })
})

test.serial('Integration.enqueue lets explicit job options override integration defaults', async (t) => {
  let captured: { name: string; data: IntegrationJobData; opts: unknown } | undefined

  class QueueingIntegration extends Integration {
    public constructor() {
      super('stub')
    }

    protected override getJobOptions() {
      return { attempts: 5, removeOnComplete: false }
    }
  }

  stubQueueAdd(t, async (name, data, opts) => {
    captured = { name, data, opts }
    return {} as never
  })

  await new QueueingIntegration().enqueue('send', { ok: true }, { removeOnComplete: true, jobId: 'job-1' })

  t.deepEqual(captured, {
    name: 'stub.send',
    data: { integrationKey: 'stub', operation: 'send', payload: { ok: true } },
    opts: { attempts: 5, removeOnComplete: true, jobId: 'job-1' }
  })
})

test.serial('processIntegrationJob dispatches to the matching integration instance', async (t) => {
  const calls: Array<{ operation: string; payload: unknown }> = []

  class StubIntegration extends Integration {
    public constructor() {
      super('stub')
    }

    public override async execute(operation: string, payload: unknown) {
      calls.push({ operation, payload })
    }
  }

  await processIntegrationJob({ integrationKey: 'stub', operation: 'run', payload: { ok: true } }, [new StubIntegration()])

  t.deepEqual(calls, [{ operation: 'run', payload: { ok: true } }])
})

test.serial('Integration.execute dispatches scheduled operations through scheduledActions', async (t) => {
  const calls: unknown[] = []

  class ScheduledIntegration extends Integration {
    public override readonly scheduledActions = [
      {
        scheduleKey: 'sync',
        defaultSchedule: { type: 'daily', hour: 1, minute: 0 } as const,
        enabledByDefault: true,
        description: 'stub sync',
        operation: 'sync',
        execute: async (payload: unknown) => {
          calls.push(payload)
        }
      }
    ]

    public constructor() {
      super('stub')
    }
  }

  await new ScheduledIntegration().execute('sync', { ok: true })

  t.deepEqual(calls, [{ ok: true }])
})

test('processIntegrationJob throws for an unknown integration key', async (t) => {
  await t.throwsAsync(() => processIntegrationJob({ integrationKey: 'missing', operation: 'run', payload: {} }, []), {
    message: "No integration found for key 'missing'."
  })
})
