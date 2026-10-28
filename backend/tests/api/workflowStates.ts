import test, { type ExecutionContext } from 'ava'
import mongoose, { Types } from 'mongoose'
import { objectToFormFields } from '../../helper.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const reader = await createAgent()
await loginUser(reader, 'admin')

// Business examples, deliberately independent of controller predicates.
const states = { draft: 10, review: 20, ready: 30, booked: 40 } as const
const actions = [
  { name: 'submit', role: 'owner', from: 'draft', to: 'review' },
  { name: 'return', role: 'examiner', from: 'review', to: 'draft' },
  { name: 'complete', role: 'examiner', from: 'review', to: 'ready' },
  { name: 'book', role: 'examiner', from: 'ready', to: 'booked' }
] as const
const reportTypes = ['travel', 'expenseReport', 'healthCareCost'] as const

async function details(type: string, id: string) {
  return (await reader.get(`/admin/${type}`).query({ _id: id }).expect(200)).body.data
}

function financialState(report: Record<string, unknown>) {
  const { state, bookings, advances, addUp, expenses, days } = report
  return { state, bookings, advances, addUp, expenses, days }
}

async function fixture(t: ExecutionContext, type: (typeof reportTypes)[number], target: keyof typeof states) {
  await loginUser(agent, 'user')
  const project = (await agent.get('/project').expect(200)).body.data[0]
  const categories = (await agent.get('/category').expect(200)).body.data
  const category = categories.find(
    (value: { for: string }) => value.for === (type === 'travel' ? 'Travel' : 'ExpenseReport') || value.for === 'both'
  )
  const insurance = (await agent.get('/healthInsurance').expect(200)).body.data[0]
  const created = await agent
    .post(`/${type}/${type === 'travel' ? 'appliedFor' : 'inWork'}`)
    .send({
      name: `Workflow example ${new Types.ObjectId()}`,
      reason: 'Conference',
      project,
      insurance,
      patientName: 'Example Patient',
      destinationPlace: { country: 'DE', place: 'Berlin' },
      startDate: '2026-07-01',
      endDate: '2026-07-01'
    })
    .expect(200)
  const id = created.body.result._id as string
  t.teardown(async () => {
    const model = mongoose.model(type === 'travel' ? 'Travel' : type === 'expenseReport' ? 'ExpenseReport' : 'HealthCareCost')
    const report = await model.findById(id)
    await report?.deleteOne()
  })
  const examiner = type === 'travel' ? 'travel' : type
  if (type === 'travel') {
    await loginUser(agent, examiner)
    await agent.post('/approve/travel/approved').send({ _id: id }).expect(200)
    await loginUser(agent, 'user')
  }
  const cost = {
    currency: 'EUR',
    date: '2026-07-01',
    positions: [{ kind: 'manual', description: 'Train ticket', grossAmount: 119, vatRate: 19, project, category }],
    receipts: [{ name: 'Invoice.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }]
  }
  const record =
    type === 'travel'
      ? {
          departure: '2026-07-01T08:00:00Z',
          arrival: '2026-07-01T19:00:00Z',
          startLocation: { country: 'DE', place: 'Berlin' },
          endLocation: { country: 'DE', place: 'Berlin' },
          transport: { type: 'otherTransport' },
          purpose: 'professional',
          cost
        }
      : { description: 'Train ticket', cost }
  let request = agent.post(`/${type}/${type === 'travel' ? 'stage' : 'expense'}`).query({ parentId: id })
  for (const entry of objectToFormFields(record))
    request = entry.field.endsWith('[data]') ? request.attach(entry.field, entry.val) : request.field(entry.field, entry.val)
  await request.expect(200)
  if (target !== 'draft') await agent.post(`/${type}/underExamination`).send({ _id: id }).expect(200)
  if (target === 'ready' || target === 'booked') {
    await loginUser(agent, examiner)
    await agent.post(`/examine/${type}/reviewCompleted`).send({ _id: id }).expect(200)
  }
  if (target === 'booked') {
    const response = await agent.post(`/book/${type}/booked`).send([id]).expect(200)
    t.is(response.body.result[0].status, 'fulfilled')
  }
  t.is((await details(type, id)).state, states[target])
  return { id, examiner: examiner as (typeof reportTypes)[number] }
}

for (const type of reportTypes) {
  for (const source of Object.keys(states) as (keyof typeof states)[]) {
    for (const action of actions) {
      test.serial(
        `${type}: given ${source}, ${action.role} ${action.name} ${source === action.from ? `moves to ${action.to}` : 'is refused without changing financial data'}`,
        async (t) => {
          const { id, examiner } = await fixture(t, type, source)
          const before = financialState(await details(type, id))
          await loginUser(agent, action.role === 'owner' ? 'user' : examiner)
          const endpoint =
            action.name === 'submit'
              ? `/${type}/underExamination`
              : action.name === 'return'
                ? `/examine/${type}/${type === 'travel' ? 'approved' : 'inWork'}`
                : action.name === 'complete'
                  ? `/examine/${type}/reviewCompleted`
                  : `/book/${type}/booked`
          const response = await agent.post(endpoint).send(action.name === 'book' ? [id] : { _id: id, comment: 'State example' })
          const allowed = source === action.from
          if (action.name === 'book') {
            t.is(response.status, allowed ? 200 : 403)
            if (allowed) t.is(response.body.result[0].status, 'fulfilled')
          } else {
            t.is(response.status, allowed ? 200 : 403, JSON.stringify(response.body))
          }
          const after = await details(type, id)
          t.is(after.state, allowed ? states[action.to] : states[source])
          if (!allowed) t.deepEqual(financialState(after), before)
          if (allowed && action.name === 'complete') t.true(after.addUp.some((row: { total: { amount: number } }) => row.total.amount > 0))
        }
      )
    }
    test.serial(`${type}: given ${source}, a user without examiner permission cannot complete review`, async (t) => {
      const { id } = await fixture(t, type, source)
      const before = financialState(await details(type, id))
      await loginUser(agent, 'user')
      t.is((await agent.post(`/examine/${type}/reviewCompleted`).send({ _id: id })).status, 401)
      t.deepEqual(financialState(await details(type, id)), before)
    })
  }
}

for (const type of reportTypes) {
  test.serial(`${type}: a mixed booking batch books only the eligible report`, async (t) => {
    const ready = await fixture(t, type, 'ready')
    const draft = await fixture(t, type, 'draft')
    await loginUser(agent, ready.examiner)
    const response = await agent.post(`/book/${type}/booked`).send([ready.id, draft.id]).expect(200)
    t.deepEqual(
      response.body.result.map(({ status }: { status: string }) => status),
      ['fulfilled', 'rejected']
    )
    t.is((await details(type, ready.id)).state, states.booked)
    t.is((await details(type, draft.id)).state, states.draft)
  })
}

const advanceStates = { applied: 0, rejected: -10, approved: 30, booked: 40 } as const
const advanceActions = [
  { name: 'approve', endpoint: '/approve/advance/approved', from: ['applied'], to: 'approved' },
  { name: 'reject', endpoint: '/approve/advance/rejected', from: ['applied'], to: 'rejected' },
  { name: 'withdraw', endpoint: '/approve/advance/withdrawApproval', from: ['approved'], to: 'rejected' },
  { name: 'book', endpoint: '/book/advance/booked', from: ['approved'], to: 'booked' },
  { name: 'receive', endpoint: '/advance/received', from: ['approved', 'booked'], to: undefined }
] as const

async function advanceFixture(t: ExecutionContext, target: keyof typeof advanceStates) {
  await loginUser(agent, 'user')
  const project = (await agent.get('/project').expect(200)).body.data[0]
  const response = await agent
    .post('/advance/appliedFor')
    .send({
      name: `Advance state example ${new Types.ObjectId()}`,
      reason: 'Conference costs',
      project,
      budget: { amount: 100, currency: 'EUR' }
    })
    .expect(200)
  const id = response.body.result._id as string
  t.teardown(async () => {
    await (await mongoose.model('Advance').findById(id))?.deleteOne()
  })
  if (target !== 'applied') {
    await loginUser(agent, 'advance')
    await agent
      .post(`/approve/advance/${target === 'rejected' ? 'rejected' : 'approved'}`)
      .send({ _id: id })
      .expect(200)
  }
  if (target === 'booked') await agent.post('/book/advance/booked').send([id]).expect(200)
  t.is((await details('advance', id)).state, advanceStates[target])
  return id
}

for (const source of Object.keys(advanceStates) as (keyof typeof advanceStates)[]) {
  for (const action of advanceActions) {
    test.serial(`advance: given ${source}, ${action.name} follows the specified transition and preserves data on rejection`, async (t) => {
      const id = await advanceFixture(t, source)
      const before = await details('advance', id)
      await loginUser(agent, action.name === 'receive' ? 'user' : 'advance')
      const response = await agent
        .post(action.endpoint)
        .send(action.name === 'book' ? [id] : { _id: id, receivedOn: '2026-07-01', comment: 'Advance state example' })
      const allowed = (action.from as readonly string[]).includes(source)
      t.is(response.status, allowed ? 200 : 403, JSON.stringify(response.body))
      const after = await details('advance', id)
      t.is(after.state, allowed && action.to ? advanceStates[action.to] : advanceStates[source])
      if (!allowed) {
        for (const key of ['budget', 'balance', 'bookings', 'receivedOn', 'offsetAgainst', 'comments']) t.deepEqual(after[key], before[key])
      }
      if (allowed && action.name === 'receive') t.is(after.receivedOn, '2026-07-01T00:00:00.000Z')
    })
  }
  test.serial(`advance: given ${source}, an owner cannot approve their own advance without approval access`, async (t) => {
    const id = await advanceFixture(t, source)
    await loginUser(agent, 'user')
    t.is((await agent.post('/approve/advance/approved').send({ _id: id })).status, 401)
    t.is((await details('advance', id)).state, advanceStates[source])
  })
}

test.after.always(async () => {
  await shutdown()
})
