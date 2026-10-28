import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import test, { type ExecutionContext } from 'ava'
import { Types } from 'mongoose'
import { emitIntegrationEvent } from '../../integrations/events.js'
import { processIntegrationJob } from '../../integrations/processor.js'
import { integrations } from '../../integrations/registry.js'
import { webhookIntegration } from '../../integrations/webhooks/integration.js'
import Travel from '../../models/travel.js'
import Webhook from '../../models/webhook.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'
import { queueFixture } from '../_queue.js'

const agent = await createAgent()

async function fixture(t: ExecutionContext) {
  await loginUser(agent, 'user')
  const project = (await agent.get('/project').expect(200)).body.data[0]
  const owner = (await agent.get('/user').expect(200)).body.data
  const created = await new Travel({
    owner: owner._id,
    editor: owner._id,
    state: 0,
    name: `Webhook example ${new Types.ObjectId()}`,
    reason: 'Conference',
    project,
    destinationPlace: { country: 'DE', place: 'Berlin' },
    startDate: '2026-07-01',
    endDate: '2026-07-02'
  }).save()
  const report = JSON.parse(JSON.stringify(created.toObject()))
  const queue = queueFixture(t)
  const ids: Types.ObjectId[] = []
  t.teardown(async () => {
    await Webhook.deleteMany({ _id: { $in: ids } })
    await (await Travel.findById(report._id))?.deleteOne()
  })
  async function hook(name: string, url: string, isActive = true) {
    const value = await Webhook.create({
      name,
      executionOrder: ids.length + 1,
      reportType: ['travel'],
      onState: [report.state],
      isActive,
      request: { url, headers: { 'X-Example': name }, method: 'POST', convertBodyToFormData: false },
      script: 'function run(report) { return { body: { reportId: report._id, state: report.state } } }'
    })
    ids.push(value._id)
    return value
  }
  return { queue, report, hook }
}

test.serial('given matching active webhooks, submitting an event persists one independent delivery per hook', async (t) => {
  const { queue, report, hook } = await fixture(t)
  const first = await hook('first', 'http://127.0.0.1/first')
  const second = await hook('second', 'http://127.0.0.1/second')
  const disabled = await hook('disabled', 'http://127.0.0.1/disabled', false)
  await emitIntegrationEvent({ type: 'report.submitted', report }, [webhookIntegration])
  const jobs = (await queue.getJobs(['waiting'])).filter(({ data }) =>
    [first._id.toString(), second._id.toString()].includes((data.payload as { webhookId: string }).webhookId)
  )
  t.is(jobs.length, 2)
  t.deepEqual(
    jobs.map(({ data }) => (data.payload as { webhookId: string }).webhookId).sort(),
    [first._id.toString(), second._id.toString()].sort()
  )
  for (const job of jobs) {
    t.is(job.name, 'webhooks.deliver')
    t.is((job.data.payload as { input: { _id: string } }).input._id, report._id)
    t.true((job.opts.attempts ?? 0) > 0)
  }
  t.false(
    (await queue.getJobs(['waiting'])).some(
      ({ data }) => (data.payload as { input: { _id: string }; webhookId: string }).webhookId === disabled._id.toString()
    )
  )
})

test.serial(
  'given a queued webhook, processing delivers real HTTP and returns the response without scheduling follow-up work',
  async (t) => {
    const received: { body: unknown; example: string | string[] | undefined }[] = []
    const server = createServer(async (request, response) => {
      let body = ''
      for await (const chunk of request) body += chunk
      received.push({ body: JSON.parse(body), example: request.headers['x-example'] })
      response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"accepted":true}')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    t.teardown(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))))
    const { queue, report, hook } = await fixture(t)
    const value = await hook('delivery', `http://127.0.0.1:${(server.address() as AddressInfo).port}/deliver`)
    await emitIntegrationEvent({ type: 'report.submitted', report }, [webhookIntegration])
    const jobs = await queue.getJobs(['waiting'])
    const job = jobs.find(({ data }) => (data.payload as { webhookId: string }).webhookId === value._id.toString())
    if (!job) throw new Error('Webhook job was not persisted')
    const result = (await processIntegrationJob(job.data, integrations)) as { status: number; ok: boolean; body: unknown }
    t.deepEqual(received, [{ body: { reportId: report._id, state: report.state }, example: 'delivery' }])
    t.is(result.status, 200)
    t.true(result.ok)
    t.deepEqual(result.body, { accepted: true })
    t.is((await queue.getJobs(['waiting'])).length, jobs.length)
  }
)

test.after.always(async () => {
  await shutdown()
})
