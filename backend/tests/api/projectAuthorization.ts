import { randomUUID } from 'node:crypto'
import { AdvanceState, ProjectSimple, State, TravelState, User } from 'abrechnung-common/types.js'
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test, { type ExecutionContext } from 'ava'
import mongoose, { Types } from 'mongoose'
import type { Response } from 'supertest'
import { objectToFormFields } from '../../helper.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const reader = await createAgent()
const ownerReader = await createAgent()
const reportTypes = ['advance', 'travel', 'expenseReport', 'healthCareCost'] as const
type ReportType = (typeof reportTypes)[number]
const collections = { advance: 'advances', travel: 'travels', expenseReport: 'expensereports', healthCareCost: 'healthcarecosts' }
let owner: User<string>
let supervisedProject: ProjectSimple<string>
let otherProject: ProjectSimple<string>
let insuranceId: string
let categoryId: string

function creationPath(type: ReportType) {
  return type === 'advance' || type === 'travel' ? `/approve/${type}/approved` : `/examine/${type}/inWork`
}

function reportBody(type: ReportType, project: string) {
  const body = { name: `Project authorization ${randomUUID()}`, owner: owner._id, project, advances: [] }
  if (type === 'advance') return { ...body, reason: 'Conference costs', budget: { amount: 250, currency: 'EUR' } }
  if (type === 'travel') {
    return {
      ...body,
      reason: 'Conference',
      destinationPlace: { country: 'DE', place: 'Berlin' },
      startDate: '2026-07-01',
      endDate: '2026-07-01'
    }
  }
  if (type === 'healthCareCost') return { ...body, patientName: 'Fry', insurance: insuranceId }
  return body
}

async function restrictReviewer(type: ReportType) {
  await loginUser(agent, type)
  const reviewer = (await agent.get('/user').expect(200)).body.data as User<string>
  await reader
    .post('/admin/user')
    .send({ _id: reviewer._id, projects: { ...reviewer.projects, supervised: [supervisedProject._id] } })
    .expect(200)
  await loginUser(agent, type)
}

async function readReport(type: ReportType, id: string) {
  return (await reader.get(`/admin/${type}`).query({ _id: id }).expect(200)).body.data
}

async function readProjects() {
  return await Promise.all(
    [supervisedProject, otherProject].map(async ({ _id }) => (await reader.get('/admin/project').query({ _id }).expect(200)).body.data)
  )
}

async function savedState(type: ReportType, id: string) {
  // History is persisted but hidden by the read APIs.
  const stored = await mongoose.connection
    .collection(collections[type])
    .findOne({ _id: new Types.ObjectId(id) }, { projection: { history: 1 } })
  if (!stored) throw new Error('Missing report fixture')
  return { report: await readReport(type, id), history: stored.history, projects: await readProjects() }
}

function assertForbidden(t: ExecutionContext, response: Response) {
  t.is(response.status, 403)
  t.is(response.body.name, 'alerts.notAllowed')
}

async function assertAbsent(t: ExecutionContext, type: ReportType, names: string[]) {
  const stored = await ownerReader
    .get(`/${type}`)
    .query({ filterJSON: Base64.encode(JSON.stringify({ name: { $in: names } })) })
    .expect(200)
  t.deepEqual(stored.body.data, [])
}

async function createReview(type: 'expenseReport' | 'healthCareCost') {
  const created = await agent.post(creationPath(type)).send(reportBody(type, supervisedProject._id)).expect(200)
  const id = created.body.result._id as string
  const expense = {
    description: 'Train ticket',
    cost: {
      date: '2026-07-01',
      currency: 'EUR',
      receipts: [{ name: 'Receipt.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
      positions: [
        { kind: 'manual', description: 'Train ticket', grossAmount: 100, vatRate: 0, project: supervisedProject._id, category: categoryId }
      ]
    }
  }
  let request = ownerReader.post(`/${type}/expense`).query({ parentId: id })
  for (const entry of objectToFormFields(expense)) {
    request = entry.field.endsWith('[data]') ? request.attach(entry.field, entry.val) : request.field(entry.field, entry.val)
  }
  await request.expect(200)
  await ownerReader.post(`/${type}/underExamination`).send({ _id: id }).expect(200)
  return id
}

test.before(async () => {
  await loginUser(reader, 'admin')
  await loginUser(ownerReader, 'user')
  owner = (await ownerReader.get('/user').expect(200)).body.data
  insuranceId = (await ownerReader.get('/healthInsurance').expect(200)).body.data[0]._id
  const categories = (await ownerReader.get('/category').expect(200)).body.data
  categoryId = categories.find(({ for: value }: { for: string }) => value === 'ExpenseReport' || value === 'both')._id
  const organisation = (await reader.get('/admin/organisation').expect(200)).body.data[0]
  const projects: ProjectSimple<string>[] = []
  for (const name of ['Supervised project', 'Other project']) {
    const response = await reader
      .post('/admin/project')
      .send({ identifier: `AUTH-${randomUUID()}`, name, organisation: organisation._id, balance: { amount: 0 } })
      .expect(200)
    projects.push(response.body.result)
  }
  ;[supervisedProject, otherProject] = projects
})

for (const type of reportTypes) {
  test.serial(`${type}: reviewer creation requires authority over the target project`, async (t) => {
    await restrictReviewer(type)
    const body = reportBody(type, otherProject._id)
    const before = await readProjects()
    assertForbidden(t, await agent.post(creationPath(type)).send(body))
    await assertAbsent(t, type, [body.name])
    t.deepEqual(await readProjects(), before)
    const accepted = await agent
      .post(creationPath(type))
      .send({ ...body, project: supervisedProject._id })
      .expect(200)
    const saved = await readReport(type, accepted.body.result._id)
    t.is(saved.project._id, supervisedProject._id)
    t.is(saved.owner._id, owner._id)
    t.is(saved.state, type === 'advance' ? AdvanceState.APPROVED : State.EDITABLE_BY_OWNER)
  })
}

for (const type of ['advance', 'travel'] as const) {
  test.serial(`${type}: approval cannot reassign an application to an unauthorized project`, async (t) => {
    await restrictReviewer(type)
    const body = reportBody(type, supervisedProject._id)
    const created = await ownerReader.post(`/${type}/appliedFor`).send(body).expect(200)
    const id = created.body.result._id as string
    const before = await savedState(type, id)
    assertForbidden(t, await agent.post(creationPath(type)).send({ ...body, _id: id, project: { _id: otherProject._id } }))
    t.deepEqual(await savedState(type, id), before)
    await agent
      .post(creationPath(type))
      .send({ ...body, _id: id, project: { _id: supervisedProject._id } })
      .expect(200)
    const saved = await readReport(type, id)
    t.is(saved.project._id, supervisedProject._id)
    t.is(saved.state, type === 'advance' ? AdvanceState.APPROVED : TravelState.APPROVED)
  })
}

for (const type of ['travel', 'expenseReport', 'healthCareCost'] as const) {
  for (const action of type === 'travel' ? ['edit'] : ['edit', 'return']) {
    test.serial(`${type}: examiner ${action} checks the target project before changing data or history`, async (t) => {
      await restrictReviewer(type)
      const id =
        type === 'travel'
          ? (await agent.post(creationPath(type)).send(reportBody(type, supervisedProject._id)).expect(200)).body.result._id
          : await createReview(type)
      const endpoint = `/examine/${type}${action === 'return' ? '/inWork' : ''}`
      const before = await savedState(type, id)
      assertForbidden(t, await agent.post(endpoint).send({ _id: id, project: { _id: otherProject._id } }))
      t.deepEqual(await savedState(type, id), before)
      await agent
        .post(endpoint)
        .send({ _id: id, project: { _id: supervisedProject._id }, name: 'Permitted change' })
        .expect(200)
      const saved = await readReport(type, id)
      t.is(saved.project._id, supervisedProject._id)
      t.is(saved.name, 'Permitted change')
      t.is(saved.state, action === 'return' || type === 'travel' ? State.EDITABLE_BY_OWNER : State.IN_REVIEW)
    })
  }
}

for (const type of ['advance', 'travel', 'expenseReport'] as const) {
  test.serial(`${type}: bulk import rejects an unauthorized mixed batch without saving any rows`, async (t) => {
    await restrictReviewer(type)
    const endpoint = `/${type === 'expenseReport' ? 'examine' : 'approve'}/${type}/bulk`
    const rows = [supervisedProject, otherProject].map((project) => ({
      ...reportBody(type, project._id),
      project: project.identifier,
      owner: owner.email
    }))
    const before = await readProjects()
    assertForbidden(t, await agent.post(endpoint).send(rows))
    await assertAbsent(
      t,
      type,
      rows.map(({ name }) => name)
    )
    t.deepEqual(await readProjects(), before)
    const accepted = await agent.post(endpoint).send([rows[0]]).expect(200)
    t.is(accepted.body.result.length, 1)
    const saved = await readReport(type, accepted.body.result[0]._id)
    t.is(saved.name, rows[0].name)
    t.is(saved.project._id, supervisedProject._id)
    t.is(saved.owner._id, owner._id)
  })
}

test.after.always(async () => {
  await shutdown()
})
