import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'
import { finishNextJob, queueFixture } from '../_queue.js'

const agent = await createAgent()
const data = { integrationKey: 'webhooks', operation: 'deliver', payload: { webhookId: 'hook-1' } }

test.serial('given no administrator access, worker job endpoints reject the request', async (t) => {
  await loginUser(agent, 'user')
  t.is((await agent.get('/admin/jobs')).status, 401)
  t.is((await agent.get('/admin/jobs/job-1')).status, 401)
  t.is((await agent.post('/admin/jobs/job-1/retry').send({})).status, 401)
})

test.serial('given mixed job states, HTTP filtering and pagination expose exact matches and diagnostics', async (t) => {
  const queue = queueFixture(t)
  await queue.add('webhooks.deliver', data, { jobId: 'webhook-1', attempts: 1 })
  await finishNextJob(queue, 'completed')
  await queue.add('webhooks.deliver', data, { jobId: 'webhook-2', attempts: 1 })
  await finishNextJob(queue, 'failed')
  await queue.add('notifications.email.send', data, { jobId: 'mail-1' })
  await loginUser(agent, 'admin')
  const first = await agent.get('/admin/jobs').query({ name: 'webhooks.deliver', page: 1, limit: 1 }).expect(200)
  t.is(first.body.meta.count, 2)
  t.is(first.body.meta.countPages, 2)
  t.is(first.body.counts.completed, 1)
  t.is(first.body.counts.failed, 1)
  t.deepEqual(
    first.body.data.map(({ id }: { id: string }) => id),
    ['webhook-1']
  )
  t.deepEqual(first.body.jobNames, [...first.body.jobNames].sort())
  t.true(first.body.jobNames.includes('webhooks.deliver'))
  const second = await agent.get('/admin/jobs').query({ name: 'webhooks.deliver', page: 2, limit: 1 }).expect(200)
  t.deepEqual(
    second.body.data.map(({ id }: { id: string }) => id),
    ['webhook-2']
  )
  const exact = await agent.get('/admin/jobs').query({ id: 'webhook-1', name: 'webhooks.deliver', state: 'completed' }).expect(200)
  t.is(exact.body.meta.count, 1)
  t.is(exact.body.counts.failed, 0)
  for (const query of [{ id: 'webhook' }, { name: 'webhooks' }, { id: 'missing' }, { id: 'webhook-1', name: 'mail' }]) {
    const empty = await agent.get('/admin/jobs').query(query).expect(200)
    t.is(empty.body.meta.count, 0)
    t.deepEqual(empty.body.data, [])
  }
  const failed = await agent.get('/admin/jobs/webhook-2').expect(200)
  t.deepEqual(failed.body.data.payload, data.payload)
  t.is(failed.body.data.failedReason, 'Expected delivery failure')
  t.true(failed.body.data.stacktrace[0].includes('Expected delivery failure'))
  const completed = await agent.get('/admin/jobs/webhook-1').expect(200)
  t.deepEqual(completed.body.data.result, { status: 200 })
  const acrossStates = await agent.get('/admin/jobs').query({ page: 1, limit: 3 }).expect(200)
  t.is(acrossStates.body.data.length, 3)
  t.deepEqual(acrossStates.body.data.map(({ id }: { id: string }) => id).sort(), ['mail-1', 'webhook-1', 'webhook-2'])
})

test.serial('given more than 100 jobs, HTTP name filtering counts and paginates every matching job', async (t) => {
  const queue = queueFixture(t)
  await queue.addBulk(
    Array.from({ length: 105 }, (_, index) => ({
      name: index % 2 === 0 ? 'webhooks.deliver' : 'notifications.email.send',
      data,
      opts: { jobId: `job-${index}` }
    }))
  )
  await loginUser(agent, 'admin')
  const page = await agent.get('/admin/jobs').query({ name: 'webhooks.deliver', page: 2, limit: 2, state: 'waiting' }).expect(200)
  t.is(page.body.meta.count, 53)
  t.is(page.body.meta.countPages, 27)
  t.deepEqual(
    page.body.data.map(({ id }: { id: string }) => id),
    ['job-100', 'job-98']
  )
  const last = await agent.get('/admin/jobs').query({ name: 'webhooks.deliver', page: 27, limit: 2 }).expect(200)
  t.deepEqual(
    last.body.data.map(({ id }: { id: string }) => id),
    ['job-0']
  )
})

test.serial('given a failed Redis job, HTTP retry clears attempts and allows the original job to complete', async (t) => {
  const queue = queueFixture(t)
  await queue.add('webhooks.deliver', data, { jobId: 'retry-job', attempts: 1 })
  await finishNextJob(queue, 'failed')
  await loginUser(agent, 'admin')
  const response = await agent.post('/admin/jobs/retry-job/retry').send({}).expect(200)
  t.is(response.body.result.state, 'waiting')
  const waiting = await agent.get('/admin/jobs/retry-job').expect(200)
  t.is(waiting.body.data.attemptsMade, 0)
  await finishNextJob(queue, 'completed')
  t.deepEqual((await agent.get('/admin/jobs/retry-job').expect(200)).body.data.result, { status: 200 })
  t.is((await agent.post('/admin/jobs/retry-job/retry').send({})).status, 409)
  t.is((await agent.post('/admin/jobs/missing/retry').send({})).status, 404)
  t.is((await agent.get('/admin/jobs/missing')).status, 404)
})

test.after.always(async () => {
  await shutdown()
})
