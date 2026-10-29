import { randomUUID } from 'node:crypto'
import { AdvanceState, ProjectSimple, User } from 'abrechnung-common/types.js'
import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const reader = await createAgent()
const ownerReader = await createAgent()
let owner: User<string>
let approver: User<string>
let supervisedProject: ProjectSimple<string>
let otherProject: ProjectSimple<string>

async function setSupervisedProjects(projects: string[]) {
  await reader
    .post('/admin/user')
    .send({ _id: approver._id, projects: { ...approver.projects, supervised: projects } })
    .expect(200)
  await loginUser(agent, 'advance')
}

function advanceBody(project: string | { _id: string }) {
  return {
    name: `Advance authorization ${randomUUID()}`,
    reason: 'Conference costs',
    owner: owner._id,
    project,
    budget: { amount: 250, currency: 'EUR' }
  }
}

async function readAdvance(id: string) {
  return (await reader.get('/admin/advance').query({ _id: id }).expect(200)).body.data
}

async function readProject(id: string) {
  return (await reader.get('/admin/project').query({ _id: id }).expect(200)).body.data
}

test.before(async () => {
  await loginUser(reader, 'admin')
  await loginUser(ownerReader, 'user')
  owner = (await ownerReader.get('/user').expect(200)).body.data
  await loginUser(agent, 'advance')
  approver = (await agent.get('/user').expect(200)).body.data
  const organisation = (await reader.get('/admin/organisation').expect(200)).body.data[0]
  const projects: ProjectSimple<string>[] = []
  for (const name of ['Supervised project', 'Other project']) {
    const response = await reader
      .post('/admin/project')
      .send({ identifier: `ADV-AUTH-${randomUUID()}`, name, organisation: organisation._id, balance: { amount: 0 } })
      .expect(200)
    projects.push(response.body.result)
  }
  ;[supervisedProject, otherProject] = projects
})

for (const reference of ['id', 'object'] as const) {
  test.serial(`advance creation: restricted approver cannot use another project (${reference})`, async (t) => {
    await setSupervisedProjects([supervisedProject._id])
    const body = advanceBody(reference === 'id' ? otherProject._id : { _id: otherProject._id })
    const before = await readProject(otherProject._id)
    const response = await agent.post('/approve/advance/approved').send(body)
    t.is(response.status, 403, JSON.stringify(response.body))
    t.is(response.body.name, 'alerts.notAllowed')
    t.falsy(response.body.result)
    const saved = (await ownerReader.get('/advance').expect(200)).body.data
    t.false(saved.some((advance: { name: string }) => advance.name === body.name))
    t.deepEqual(await readProject(otherProject._id), before)
  })

  test.serial(`advance approval: restricted approver cannot move an application to another project (${reference})`, async (t) => {
    const body = advanceBody(supervisedProject._id)
    const created = await ownerReader.post('/advance/appliedFor').send(body).expect(200)
    const id = created.body.result._id as string
    await setSupervisedProjects([supervisedProject._id])
    const before = await readAdvance(id)
    const projectsBefore = [await readProject(supervisedProject._id), await readProject(otherProject._id)]
    const response = await agent
      .post('/approve/advance/approved')
      .send({ ...body, _id: id, project: reference === 'id' ? otherProject._id : { _id: otherProject._id } })
    t.is(response.status, 403)
    t.is(response.body.name, 'alerts.notAllowed')
    t.deepEqual(await readAdvance(id), before)
    t.deepEqual([await readProject(supervisedProject._id), await readProject(otherProject._id)], projectsBefore)
  })

  for (const restricted of [true, false]) {
    test.serial(
      `advance creation: ${restricted ? 'project-restricted' : 'unrestricted'} approver can use an authorized project (${reference})`,
      async (t) => {
        await setSupervisedProjects(restricted ? [supervisedProject._id] : [])
        const project = restricted ? supervisedProject : otherProject
        const body = advanceBody(reference === 'id' ? project._id : { _id: project._id })
        const response = await agent.post('/approve/advance/approved').send(body).expect(200)
        const saved = await readAdvance(response.body.result._id)
        t.is(saved.name, body.name)
        t.is(saved.project._id, project._id)
        t.is(saved.owner._id, owner._id)
        t.is(saved.editor._id, approver._id)
        t.is(saved.state, AdvanceState.APPROVED)
        t.is(saved.budget.amount, 250)
        t.is(saved.budget.currency._id, 'EUR')
        t.is(saved.balance.amount, 250)
        t.is(saved.balance.currency._id, 'EUR')
      }
    )
  }
}

test.serial('advance approval: restricted approver cannot approve an existing application in another project', async (t) => {
  const body = advanceBody(otherProject._id)
  const created = await ownerReader.post('/advance/appliedFor').send(body).expect(200)
  const id = created.body.result._id as string
  await setSupervisedProjects([supervisedProject._id])
  const before = await readAdvance(id)
  const projectBefore = await readProject(otherProject._id)
  const response = await agent.post('/approve/advance/approved').send({ _id: id })
  t.is(response.status, 403)
  t.is(response.body.name, 'alerts.notAllowed')
  t.deepEqual(await readAdvance(id), before)
  t.deepEqual(await readProject(otherProject._id), projectBefore)
})

test.serial('advance approval: restricted approver can approve an existing application in their project', async (t) => {
  const body = advanceBody(supervisedProject._id)
  const created = await ownerReader.post('/advance/appliedFor').send(body).expect(200)
  const id = created.body.result._id as string
  await setSupervisedProjects([supervisedProject._id])
  await agent.post('/approve/advance/approved').send({ _id: id }).expect(200)
  const saved = await readAdvance(id)
  t.is(saved.project._id, supervisedProject._id)
  t.is(saved.owner._id, owner._id)
  t.is(saved.state, AdvanceState.APPROVED)
  t.is(saved.balance.amount, 250)
})

test.after.always(async () => {
  await shutdown()
})
