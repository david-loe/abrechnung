import { Advance, ProjectSimple, User } from 'abrechnung-common/types.js'
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test, { type ExecutionContext } from 'ava'
import mongoose, { Types } from 'mongoose'
import type { Response } from 'supertest'
import { objectToFormFields } from '../../helper.js'
import AdvanceModel from '../../models/advance.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const reader = await createAgent()
const ownerReader = await createAgent()
const reportTypes = ['expenseReport', 'travel', 'healthCareCost'] as const
type ReportType = (typeof reportTypes)[number]
const collections = { expenseReport: 'expensereports', travel: 'travels', healthCareCost: 'healthcarecosts' }
let project: ProjectSimple<string>
let owner: User<string>
let examiner: User<string>
let insuranceId: string

function reportBody(type: ReportType) {
  const fields =
    type === 'travel'
      ? { reason: 'Conference', destinationPlace: { country: 'DE', place: 'Berlin' }, startDate: '2024-05-01', endDate: '2024-05-01' }
      : type === 'healthCareCost'
        ? { patientName: 'Fry', insurance: insuranceId }
        : {}
  return { name: `Ownership regression ${new Types.ObjectId()}`, project: project._id, ...fields }
}

function creationPath(type: ReportType, asReviewer = false) {
  if (type === 'travel') return asReviewer ? '/approve/travel/approved' : '/travel/appliedFor'
  return `${asReviewer ? '/examine' : ''}/${type}/inWork`
}

async function details(type: ReportType | 'advance', id: string) {
  return (await reader.get(`/admin/${type}`).query({ _id: id }).expect(200)).body.data
}

async function finances(advances: Advance<string>[]) {
  const balances = await Promise.all(
    advances.map(async ({ _id }) => {
      const { budget, balance, offsetAgainst, state, settledOn, updatedAt } = await details('advance', _id)
      return { budget, balance, offsetAgainst, state, settledOn, updatedAt }
    })
  )
  const projectState = (await reader.get('/admin/project').query({ _id: project._id }).expect(200)).body.data
  return { balances, project: projectState }
}

async function savedState(type: ReportType, id: string, advances: Advance<string>[]) {
  const report = await details(type, id)
  // History is persisted but hidden by the read APIs; financial data is read through HTTP.
  const stored = await mongoose.connection
    .collection(collections[type])
    .findOne({ _id: new Types.ObjectId(id) }, { projection: { history: 1 } })
  if (!stored) throw new Error('Missing report fixture')
  return { report, history: stored.history, finances: await finances(advances) }
}

function assertRejected(t: ExecutionContext, response: Response) {
  t.is(response.status, 422, JSON.stringify(response.body))
  t.deepEqual(response.body.errors, [{ path: 'advances', message: 'invalidAdvanceOwner' }])
  t.falsy(response.body.result)
}

async function assertNotCreated(t: ExecutionContext, type: ReportType, name: string) {
  const response = await ownerReader
    .get(`/${type}`)
    .query({ filterJSON: Base64.encode(JSON.stringify({ name })) })
    .expect(200)
  t.deepEqual(response.body.data, [])
  t.is(response.body.meta.count, 0)
}

async function createAdvance(advanceOwner: User<string>) {
  await loginUser(agent, 'advance')
  const response = await agent
    .post('/approve/advance/approved')
    .send({
      name: 'Ownership advance',
      reason: 'Conference costs',
      owner: advanceOwner._id,
      project: project._id,
      budget: { amount: 1000, currency: 'EUR' }
    })
    .expect(200)
  return response.body.result as Advance<string>
}

async function createReport(type: ReportType, advances: Advance<string>[]) {
  await loginUser(agent, 'user')
  const response = await agent
    .post(creationPath(type))
    .send({ ...reportBody(type), advances: advances.map(({ _id }) => _id) })
    .expect(200)
  const id = response.body.result._id as string
  if (type === 'travel') {
    await loginUser(agent, 'travel')
    await agent.post('/approve/travel/approved').send({ _id: id }).expect(200)
  }
  return id
}

async function historicAdvance(t: ExecutionContext, advance: Advance<string>) {
  const id = new Types.ObjectId()
  t.teardown(async () => {
    await AdvanceModel.collection.deleteOne({ _id: id })
  })
  const source = await AdvanceModel.collection.findOne({ _id: new Types.ObjectId(advance._id) })
  if (!source) throw new Error('Missing advance fixture')
  const { reference: _reference, ...historic } = source
  await AdvanceModel.collection.insertOne({ ...historic, _id: id, historic: true })
  return id.toString()
}

async function submitForReview(type: ReportType, id: string) {
  await loginUser(agent, 'user')
  const categories = (await agent.get('/category').expect(200)).body.data
  const category = categories.find(
    ({ for: value }: { for: string }) => value === (type === 'travel' ? 'Travel' : 'ExpenseReport') || value === 'both'
  )
  const cost = {
    date: '2024-05-01',
    currency: 'EUR',
    receipts: [{ name: 'Receipt.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
    positions: [{ kind: 'manual', description: 'Train ticket', grossAmount: 100, vatRate: 0, project: project._id, category: category._id }]
  }
  const record =
    type === 'travel'
      ? {
          departure: '2024-05-01T08:00:00Z',
          arrival: '2024-05-01T19:00:00Z',
          startLocation: { country: 'DE', place: 'Berlin' },
          endLocation: { country: 'DE', place: 'Berlin' },
          transport: { type: 'otherTransport' },
          purpose: 'professional',
          cost
        }
      : { description: 'Train ticket', cost }
  let request = agent.post(`/${type}/${type === 'travel' ? 'stage' : 'expense'}`).query({ parentId: id })
  for (const entry of objectToFormFields(record)) {
    request = entry.field.endsWith('[data]') ? request.attach(entry.field, entry.val) : request.field(entry.field, entry.val)
  }
  await request.expect(200)
  await agent.post(`/${type}/underExamination`).send({ _id: id }).expect(200)
}

test.before(async () => {
  await loginUser(reader, 'admin')
  await loginUser(ownerReader, 'user')
  owner = (await ownerReader.get('/user').expect(200)).body.data
  project = (await ownerReader.get('/project').expect(200)).body.data[0]
  insuranceId = (await ownerReader.get('/healthInsurance').expect(200)).body.data[0]._id
  await loginUser(agent, 'expenseReport')
  examiner = (await agent.get('/user').expect(200)).body.data
})

for (const type of reportTypes) {
  test.serial(`${type}: creating a report rejects another owner's advance`, async (t) => {
    const foreign = await createAdvance(examiner)
    await loginUser(agent, 'user')
    const before = await finances([foreign])
    const body = { ...reportBody(type), advances: [foreign._id] }
    assertRejected(t, await agent.post(creationPath(type)).send(body))
    await assertNotCreated(t, type, body.name)
    t.deepEqual(await finances([foreign]), before)
  })

  for (const role of ['owner', 'examiner'] as const) {
    test.serial(`${type}: ${role} cannot save a mixed selection or change financial data`, async (t) => {
      const advances = [await createAdvance(owner), await createAdvance(examiner)]
      const id = await createReport(type, [advances[0]])
      await loginUser(agent, role === 'owner' ? 'user' : type)
      const before = await savedState(type, id, advances)
      const endpoint = role === 'owner' ? creationPath(type) : `/examine/${type}`
      assertRejected(t, await agent.post(endpoint).send({ _id: id, advances: advances.map(({ _id }) => _id) }))
      t.deepEqual(await savedState(type, id, advances), before)
    })
  }

  test.serial(`${type}: reviewer creation uses the selected owner and deduplicates valid advances`, async (t) => {
    await loginUser(agent, type)
    const reviewer = (await agent.get('/user').expect(200)).body.data as User<string>
    const advances = [await createAdvance(owner), await createAdvance(reviewer)]
    await loginUser(agent, type)
    const body = { ...reportBody(type), owner: owner._id }
    const before = await finances(advances)
    assertRejected(t, await agent.post(creationPath(type, true)).send({ ...body, advances: [advances[1]._id] }))
    await assertNotCreated(t, type, body.name)
    t.deepEqual(await finances(advances), before)
    const accepted = await agent
      .post(creationPath(type, true))
      .send({ ...body, advances: [advances[0]._id, advances[0]._id] })
      .expect(200)
    const saved = await details(type, accepted.body.result._id)
    t.is(saved.owner._id, owner._id)
    t.deepEqual(
      saved.advances.map(({ _id }: { _id: string }) => _id),
      [advances[0]._id]
    )
  })

  test.serial(`${type}: review rejects a stored cross-owner link without changing balances or history`, async (t) => {
    const advances = [await createAdvance(owner), await createAdvance(examiner)]
    const id = await createReport(type, [advances[0]])
    await submitForReview(type, id)
    // Current APIs cannot create the invalid relationship left by older versions.
    await mongoose.connection
      .collection(collections[type])
      .updateOne({ _id: new Types.ObjectId(id) }, { $set: { advances: [new Types.ObjectId(advances[1]._id)] } })
    await loginUser(agent, type)
    const before = await savedState(type, id, advances)
    assertRejected(t, await agent.post(`/examine/${type}/reviewCompleted`).send({ _id: id }))
    t.deepEqual(await savedState(type, id, advances), before)
  })
}

for (const type of ['expenseReport', 'healthCareCost'] as const) {
  test.serial(`${type}: returning to draft validates advances against the changed owner`, async (t) => {
    const advances = [await createAdvance(owner), await createAdvance(examiner)]
    const id = await createReport(type, [advances[0]])
    await submitForReview(type, id)
    await loginUser(agent, type)
    const before = await savedState(type, id, advances)
    assertRejected(t, await agent.post(`/examine/${type}/inWork`).send({ _id: id, owner: examiner._id }))
    t.deepEqual(await savedState(type, id, advances), before)
    await agent
      .post(`/examine/${type}/inWork`)
      .send({ _id: id, owner: examiner._id, advances: [advances[1]._id] })
      .expect(200)
    const saved = await details(type, id)
    t.is(saved.owner._id, examiner._id)
    t.is(saved.advances[0]._id, advances[1]._id)
  })
}

test.serial('travel approval rejects changed selections before writing history', async (t) => {
  const advances = [await createAdvance(owner), await createAdvance(examiner)]
  await loginUser(agent, 'user')
  const created = await agent
    .post('/travel/appliedFor')
    .send({ ...reportBody('travel'), advances: [advances[0]._id] })
    .expect(200)
  const id = created.body.result._id as string
  await loginUser(agent, 'travel')
  const before = await savedState('travel', id, advances)
  assertRejected(t, await agent.post('/approve/travel/approved').send({ _id: id, owner: owner._id, advances: [advances[1]._id] }))
  t.deepEqual(await savedState('travel', id, advances), before)
  await agent
    .post('/approve/travel/approved')
    .send({ _id: id, owner: owner._id, advances: [advances[0]._id] })
    .expect(200)
  t.is((await details('travel', id)).advances[0]._id, advances[0]._id)
})

test.serial('direct travel approval validates creation and subsequent selections', async (t) => {
  const advances = [await createAdvance(owner), await createAdvance(examiner)]
  await loginUser(agent, 'admin')
  await agent
    .post('/admin/user')
    .send({ _id: owner._id, access: { ...owner.access, 'approved:travel': true } })
    .expect(200)
  try {
    await loginUser(agent, 'user')
    const body = reportBody('travel')
    const before = await finances(advances)
    assertRejected(t, await agent.post('/travel/approved').send({ ...body, advances: [advances[1]._id] }))
    await assertNotCreated(t, 'travel', body.name)
    t.deepEqual(await finances(advances), before)
    const created = await agent
      .post('/travel/approved')
      .send({ ...body, advances: [advances[0]._id] })
      .expect(200)
    const id = created.body.result._id as string
    const saved = await savedState('travel', id, advances)
    assertRejected(t, await agent.post('/travel/approved').send({ _id: id, advances: advances.map(({ _id }) => _id) }))
    t.deepEqual(await savedState('travel', id, advances), saved)
  } finally {
    await loginUser(agent, 'admin')
    await agent.post('/admin/user').send({ _id: owner._id, access: owner.access }).expect(200)
  }
})

test.serial('expenseReport: missing and historic advance references are rejected', async (t) => {
  const advance = await createAdvance(owner)
  const historic = await historicAdvance(t, advance)
  await loginUser(agent, 'user')
  const before = await finances([advance])
  for (const id of [new Types.ObjectId().toString(), historic]) {
    const body = { ...reportBody('expenseReport'), advances: [id] }
    assertRejected(t, await agent.post('/expenseReport/inWork').send(body))
    await assertNotCreated(t, 'expenseReport', body.name)
    t.deepEqual(await finances([advance]), before)
  }
})

test.after.always(async () => {
  await shutdown()
})
