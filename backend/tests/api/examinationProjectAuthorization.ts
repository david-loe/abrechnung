import { randomUUID } from 'node:crypto'
import { ProjectSimple, State, User } from 'abrechnung-common/types.js'
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test from 'ava'
import mongoose, { Types } from 'mongoose'
import { objectToFormFields } from '../../helper.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const reader = await createAgent()
const ownerReader = await createAgent()
const reportTypes = ['expenseReport', 'healthCareCost'] as const
type ReportType = (typeof reportTypes)[number]
let owner: User<string>
let supervisedProject: ProjectSimple<string>
let otherProject: ProjectSimple<string>
let insuranceId: string
let categoryId: string

async function setSupervisedProjects(type: ReportType, projects: string[]) {
  await loginUser(agent, type)
  const examiner = (await agent.get('/user').expect(200)).body.data as User<string>
  await reader
    .post('/admin/user')
    .send({ _id: examiner._id, projects: { ...examiner.projects, supervised: projects } })
    .expect(200)
  await loginUser(agent, type)
  return examiner
}

function reportBody(type: ReportType, project: string | { _id: string }) {
  return {
    name: `Examination authorization ${randomUUID()}`,
    project,
    owner: owner._id,
    advances: [],
    ...(type === 'healthCareCost' ? { patientName: 'Fry', insurance: insuranceId } : {})
  }
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
    .collection(type === 'expenseReport' ? 'expensereports' : 'healthcarecosts')
    .findOne({ _id: new Types.ObjectId(id) }, { projection: { history: 1 } })
  if (!stored) throw new Error('Missing report fixture')
  return { report: await readReport(type, id), history: stored.history, projects: await readProjects() }
}

async function createReport(type: ReportType, project: string, review = false) {
  const response = await ownerReader.post(`/${type}/inWork`).send(reportBody(type, project)).expect(200)
  const id = response.body.result._id as string
  if (review) {
    const expense = {
      description: 'Train ticket',
      cost: {
        date: '2026-07-01',
        currency: 'EUR',
        receipts: [{ name: 'Receipt.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
        positions: [{ kind: 'manual', description: 'Train ticket', grossAmount: 100, vatRate: 0, project, category: categoryId }]
      }
    }
    let request = ownerReader.post(`/${type}/expense`).query({ parentId: id })
    for (const entry of objectToFormFields(expense)) {
      request = entry.field.endsWith('[data]') ? request.attach(entry.field, entry.val) : request.field(entry.field, entry.val)
    }
    await request.expect(200)
    await ownerReader.post(`/${type}/underExamination`).send({ _id: id }).expect(200)
  }
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
  for (const name of ['Supervised examination project', 'Other examination project']) {
    const response = await reader
      .post('/admin/project')
      .send({ identifier: `EXAM-AUTH-${randomUUID()}`, name, organisation: organisation._id, balance: { amount: 0 } })
      .expect(200)
    projects.push(response.body.result)
  }
  ;[supervisedProject, otherProject] = projects
})

for (const type of reportTypes) {
  for (const reference of ['id', 'object'] as const) {
    test.serial(`${type}: restricted examiner cannot create another project's draft (${reference})`, async (t) => {
      await setSupervisedProjects(type, [supervisedProject._id])
      const body = reportBody(type, reference === 'id' ? otherProject._id : { _id: otherProject._id })
      const before = await readProjects()
      const response = await agent.post(`/examine/${type}/inWork`).send(body)
      t.is(response.status, 403)
      t.is(response.body.name, 'alerts.notAllowed')
      t.falsy(response.body.result)
      const stored = await ownerReader
        .get(`/${type}`)
        .query({ filterJSON: Base64.encode(JSON.stringify({ name: body.name })) })
        .expect(200)
      t.deepEqual(stored.body.data, [])
      t.is(stored.body.meta.count, 0)
      t.deepEqual(await readProjects(), before)
    })

    test.serial(`${type}: restricted examiner can create their project's draft (${reference})`, async (t) => {
      const examiner = await setSupervisedProjects(type, [supervisedProject._id])
      const body = reportBody(type, reference === 'id' ? supervisedProject._id : { _id: supervisedProject._id })
      const response = await agent.post(`/examine/${type}/inWork`).send(body).expect(200)
      const saved = await readReport(type, response.body.result._id)
      t.is(saved.name, body.name)
      t.is(saved.owner._id, owner._id)
      t.is(saved.editor._id, examiner._id)
      t.is(saved.project._id, supervisedProject._id)
      t.is(saved.state, State.EDITABLE_BY_OWNER)
    })

    for (const review of [false, true]) {
      test.serial(
        `${type}: examiner cannot move a ${review ? 'review' : 'draft'} report outside their projects (${reference})`,
        async (t) => {
          const id = await createReport(type, supervisedProject._id, review)
          await setSupervisedProjects(type, [supervisedProject._id])
          const before = await savedState(type, id)
          const response = await agent
            .post(`/examine/${type}`)
            .send({ _id: id, project: reference === 'id' ? otherProject._id : { _id: otherProject._id } })
          t.is(response.status, 403)
          t.is(response.body.name, 'alerts.notAllowed')
          t.deepEqual(await savedState(type, id), before)
        }
      )
    }

    test.serial(`${type}: returning to draft cannot change to an unauthorized project (${reference})`, async (t) => {
      const id = await createReport(type, supervisedProject._id, true)
      await setSupervisedProjects(type, [supervisedProject._id])
      const before = await savedState(type, id)
      const response = await agent
        .post(`/examine/${type}/inWork`)
        .send({ _id: id, project: reference === 'id' ? otherProject._id : { _id: otherProject._id } })
      t.is(response.status, 403)
      t.is(response.body.name, 'alerts.notAllowed')
      t.deepEqual(await savedState(type, id), before)
    })
  }

  test.serial(`${type}: unrestricted examiner can create a draft in another project`, async (t) => {
    await setSupervisedProjects(type, [])
    const body = reportBody(type, otherProject._id)
    const response = await agent.post(`/examine/${type}/inWork`).send(body).expect(200)
    const saved = await readReport(type, response.body.result._id)
    t.is(saved.project._id, otherProject._id)
    t.is(saved.owner._id, owner._id)
    t.is(saved.state, State.EDITABLE_BY_OWNER)
  })

  for (const action of ['edit', 'return']) {
    test.serial(`${type}: ${action} can move a report between supervised projects`, async (t) => {
      const id = await createReport(type, supervisedProject._id, action === 'return')
      await setSupervisedProjects(type, [supervisedProject._id, otherProject._id])
      await agent
        .post(`/examine/${type}${action === 'return' ? '/inWork' : ''}`)
        .send({ _id: id, project: otherProject._id })
        .expect(200)
      const saved = await readReport(type, id)
      t.is(saved.project._id, otherProject._id)
      t.is(saved.owner._id, owner._id)
      t.is(saved.state, State.EDITABLE_BY_OWNER)
    })

    test.serial(`${type}: ${action} still checks the stored project when no target project is supplied`, async (t) => {
      const id = await createReport(type, otherProject._id, action === 'return')
      await setSupervisedProjects(type, [supervisedProject._id])
      const before = await savedState(type, id)
      const response = await agent
        .post(`/examine/${type}${action === 'return' ? '/inWork' : ''}`)
        .send({ _id: id, name: 'Forbidden change' })
      t.is(response.status, 403)
      t.deepEqual(await savedState(type, id), before)
    })
  }

  test.serial(`${type}: completing review of another project's report is already forbidden`, async (t) => {
    const id = await createReport(type, otherProject._id, true)
    await setSupervisedProjects(type, [supervisedProject._id])
    const before = await savedState(type, id)
    const response = await agent.post(`/examine/${type}/reviewCompleted`).send({ _id: id })
    t.is(response.status, 403)
    t.deepEqual(await savedState(type, id), before)
  })

  test.serial(`${type}: an owner's own creation uses their personal permission`, async (t) => {
    await reader
      .post('/admin/user')
      .send({ _id: owner._id, projects: { ...owner.projects, supervised: [supervisedProject._id] } })
      .expect(200)
    try {
      await loginUser(ownerReader, 'user')
      const id = await createReport(type, otherProject._id)
      const saved = await readReport(type, id)
      t.is(saved.owner._id, owner._id)
      t.is(saved.project._id, otherProject._id)
      t.is(saved.state, State.EDITABLE_BY_OWNER)
    } finally {
      await reader.post('/admin/user').send({ _id: owner._id, projects: owner.projects }).expect(200)
      await loginUser(ownerReader, 'user')
    }
  })
}

test.after.always(async () => {
  await shutdown()
})
