import test, { type ExecutionContext } from 'ava'
import { Types } from 'mongoose'
import { emitIntegrationEvent, type IntegrationEvent } from '../../integrations/events.js'
import { integrations } from '../../integrations/registry.js'
import Advance from '../../models/advance.js'
import Organisation from '../../models/organisation.js'
import Travel from '../../models/travel.js'
import Webhook from '../../models/webhook.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'
import { queueFixture } from '../_queue.js'

const agent = await createAgent()

async function fixture(t: ExecutionContext, advance = false) {
  await loginUser(agent, 'user')
  const project = (await agent.get('/project').expect(200)).body.data[0]
  const body = {
    name: `Integration event ${new Types.ObjectId()}`,
    reason: 'Conference',
    project,
    budget: { amount: 100, currency: 'EUR' },
    destinationPlace: { country: 'DE', place: 'Berlin' },
    startDate: '2026-07-01',
    endDate: '2026-07-02'
  }
  const owner = (await agent.get('/user').expect(200)).body.data
  const document = advance
    ? await new Advance({ ...body, owner: owner._id, editor: owner._id, state: 0 }).save()
    : await new Travel({ ...body, owner: owner._id, editor: owner._id, state: 0 }).save()
  const report = JSON.parse(JSON.stringify(document.toObject()))
  const queue = queueFixture(t)
  const webhook = await Webhook.create({
    name: `Event example ${new Types.ObjectId()}`,
    executionOrder: 1,
    isActive: true,
    reportType: ['travel'],
    onState: [-10, 0, 10, 20, 30],
    request: { url: 'http://127.0.0.1/event-example', method: 'POST', headers: {}, convertBodyToFormData: false }
  })
  t.teardown(async () => {
    await Webhook.deleteOne({ _id: webhook._id })
    if (advance) await (await Advance.findById(report._id))?.deleteOne()
    else await (await Travel.findById(report._id))?.deleteOne()
  })
  return { report, queue, webhook }
}

const examples = [
  { type: 'report.submitted', state: 0, webhooks: true, reportMail: false },
  { type: 'report.review_completed', state: 30, webhooks: true, reportMail: true },
  { type: 'report.approval_withdrawn', state: -10, webhooks: false, reportMail: false },
  { type: 'travel.back_to_approved', state: 10, webhooks: false, reportMail: false },
  { type: 'advance.deleted', state: 0, webhooks: false, reportMail: false }
] as const
for (const example of examples) {
  test.serial(`given ${example.type}, real integrations persist the appropriate outbound work`, async (t) => {
    const { report, queue, webhook } = await fixture(t, example.type === 'advance.deleted')
    report.state = example.state
    await emitIntegrationEvent({ type: example.type, report, deletedBy: 'Bender' } as IntegrationEvent, integrations)
    const jobs = await queue.getJobs(['waiting'])
    t.is(
      jobs.some(
        ({ name, data }) => name === 'webhooks.deliver' && (data.payload as { webhookId: string }).webhookId === webhook._id.toString()
      ),
      example.webhooks
    )
    t.is(
      jobs.some(({ name }) => name === 'reports.email.send'),
      example.reportMail
    )
    t.true(jobs.some(({ name }) => name === 'notifications.email.send'))
    const notifications = jobs.filter(({ name }) => name === 'notifications.push.send')
    t.is(notifications.length, 1)
    if (example.type === 'report.approval_withdrawn' || example.type === 'advance.deleted') {
      const payload = notifications[0].data.payload as { userIds: string[]; url: string }
      t.deepEqual(payload.userIds, [report.owner._id])
      t.true(payload.url.includes(example.type === 'advance.deleted' ? '/advance' : `/user/travel/${report._id}`))
    }
  })
}

for (const [crossBorder, requiresA1] of [
  [true, true],
  [false, true],
  [true, false],
  [false, false]
]) {
  test.serial(`given direct travel approval, A1 mail requires both cross-border=${crossBorder} and A1-country=${requiresA1}`, async (t) => {
    const { report, queue } = await fixture(t)
    const source = await Organisation.findOne().lean().orFail()
    const { _id: _sourceId, ...values } = source
    const org = await Organisation.create({
      ...values,
      name: `A1 example ${new Types.ObjectId()}`,
      a1CertificateEmail: 'a1@example.invalid'
    })
    t.teardown(async () => {
      await Organisation.deleteOne({ _id: org._id })
    })
    report.project.organisation = org._id
    report.state = 10
    report.isCrossBorder = crossBorder
    report.destinationPlace.country.needsA1Certificate = requiresA1
    await emitIntegrationEvent({ type: 'travel.directly_approved', report }, integrations)
    const jobs = await queue.getJobs(['waiting'])
    const a1 = jobs.filter(
      ({ name, data }) =>
        name === 'notifications.email.send' && (data.payload as { recipient: { email: string } }).recipient.email === 'a1@example.invalid'
    )
    t.is(a1.length, crossBorder && requiresA1 ? 1 : 0)
    t.false(jobs.some(({ name }) => name === 'reports.email.send' || name === 'notifications.push.send'))
    if (a1[0]) t.true(JSON.stringify(a1[0].data.payload).includes(report.reason))
  })
}

test.after.always(async () => {
  await shutdown()
})
