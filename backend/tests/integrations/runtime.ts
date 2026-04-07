import test, { ExecutionContext } from 'ava'
import { type Queue } from 'bullmq'
import { Integration } from '../../integrations/integration.js'
import { processIntegrationJob } from '../../integrations/processor.js'
import { closeIntegrationQueue, type IntegrationJobData, setIntegrationQueueForTests } from '../../integrations/queue.js'

function stubQueueAdd(t: ExecutionContext, implementation: (name: string, data: IntegrationJobData, opts?: unknown) => Promise<unknown>) {
  setIntegrationQueueForTests({
    add: implementation as never,
    close: async () => {},
    getJob: async () => undefined,
    getJobSchedulers: async () => [],
    removeJobScheduler: async () => true,
    upsertJobScheduler: async () => ({}) as never
  } as unknown as Queue<IntegrationJobData>)
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
    public override readonly operations = {
      send: { jobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } }, run: async () => {} }
    }

    public constructor() {
      super('stub')
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
    public override readonly operations = { send: { jobOptions: { attempts: 5, removeOnComplete: false }, run: async () => {} } }

    public constructor() {
      super('stub')
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
    public override readonly operations = {
      run: {
        run: async (payload: unknown) => {
          calls.push({ operation: 'run', payload })
        }
      }
    }

    public constructor() {
      super('stub')
    }
  }

  await processIntegrationJob({ integrationKey: 'stub', operation: 'run', payload: { ok: true } }, [new StubIntegration()])

  t.deepEqual(calls, [{ operation: 'run', payload: { ok: true } }])
})

test.serial('processIntegrationJob dispatches scheduled jobs to the matching operation', async (t) => {
  const calls: unknown[] = []

  class ScheduledIntegration extends Integration {
    public override readonly operations = {
      sync: {
        run: async (payload: unknown) => {
          calls.push(payload)
        }
      }
    }

    public constructor() {
      super('stub')
    }
  }

  await processIntegrationJob({ integrationKey: 'stub', operation: 'sync', payload: { ok: true } }, [new ScheduledIntegration()])

  t.deepEqual(calls, [{ ok: true }])
})

test.serial('processIntegrationJob resolves payload via buildPayload when the queued payload is null', async (t) => {
  const calls: unknown[] = []

  class ScheduledIntegration extends Integration {
    public override readonly operations = {
      sync: {
        buildPayload: async () => ({ ok: true }),
        run: async (payload: unknown) => {
          calls.push(payload)
        }
      }
    }

    public constructor() {
      super('stub')
    }
  }

  await processIntegrationJob({ integrationKey: 'stub', operation: 'sync', payload: null }, [new ScheduledIntegration()])

  t.deepEqual(calls, [{ ok: true }])
})

test('processIntegrationJob throws for an unknown integration key', async (t) => {
  await t.throwsAsync(() => processIntegrationJob({ integrationKey: 'missing', operation: 'run', payload: {} }, []), {
    message: "No integration found for key 'missing'."
  })
})

test('processIntegrationJob throws for an unknown operation', async (t) => {
  await t.throwsAsync(() => processIntegrationJob({ integrationKey: 'stub', operation: 'run', payload: {} }, [new Integration('stub')]), {
    message: "No operation 'run' found for integration 'stub'."
  })
})
