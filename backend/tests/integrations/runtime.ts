import test from 'ava'
import { Integration } from '../../integrations/integration.js'
import { processIntegrationJob } from '../../integrations/processor.js'
import { closeIntegrationQueue } from '../../integrations/queue.js'
import { queueFixture } from '../_queue.js'

test.after.always(async () => {
  await closeIntegrationQueue()
})

test.serial('Integration.enqueue applies integration-specific job options', async (t) => {
  const queue = queueFixture(t)

  class QueueingIntegration extends Integration {
    public override readonly operations = {
      send: { jobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } }, run: async () => {} }
    }

    public constructor() {
      super('stub')
    }
  }

  await new QueueingIntegration().enqueue('send', { ok: true })

  const [job] = await queue.getJobs(['waiting'])
  t.truthy(job)
  t.deepEqual(
    {
      name: job.name,
      data: job.data,
      opts: {
        attempts: job.opts.attempts,
        ...(job.opts.backoff ? { backoff: job.opts.backoff } : {}),
        ...(job.opts.jobId ? { jobId: job.opts.jobId } : {})
      }
    },
    {
      name: 'stub.send',
      data: { integrationKey: 'stub', operation: 'send', payload: { ok: true } },
      opts: { attempts: 5, backoff: { type: 'exponential', delay: 5_000 } }
    }
  )
})

test.serial('Integration.enqueue lets explicit job options override integration defaults', async (t) => {
  const queue = queueFixture(t)

  class QueueingIntegration extends Integration {
    public override readonly operations = { send: { jobOptions: { attempts: 5, removeOnComplete: false }, run: async () => {} } }

    public constructor() {
      super('stub')
    }
  }

  await new QueueingIntegration().enqueue('send', { ok: true }, { attempts: 2, removeOnComplete: true, jobId: 'job-1' })

  const [job] = await queue.getJobs(['waiting'])
  t.truthy(job)
  t.deepEqual(
    {
      name: job.name,
      data: job.data,
      opts: {
        attempts: job.opts.attempts,
        ...(job.opts.backoff ? { backoff: job.opts.backoff } : {}),
        ...(job.opts.jobId ? { jobId: job.opts.jobId } : {})
      }
    },
    { name: 'stub.send', data: { integrationKey: 'stub', operation: 'send', payload: { ok: true } }, opts: { attempts: 2, jobId: 'job-1' } }
  )
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

test('processIntegrationJob returns the operation result for BullMQ persistence', async (t) => {
  class ResultIntegration extends Integration {
    public override readonly operations = { run: { run: async () => ({ status: 200, ok: true }) } }

    public constructor() {
      super('stub')
    }
  }

  const result = await processIntegrationJob({ integrationKey: 'stub', operation: 'run', payload: {} }, [new ResultIntegration()])
  t.deepEqual(result, { status: 200, ok: true })
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
