import { randomUUID } from 'node:crypto'
import { ProjectSimple, TravelState, User } from 'abrechnung-common/types.js'
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
  await loginUser(agent, 'travel')
}

function travelBody(project: string | { _id: string }) {
  return {
    name: `Travel authorization ${randomUUID()}`,
    reason: 'Conference costs',
    owner: owner._id,
    project,
    destinationPlace: { country: 'DE', place: 'Berlin' },
    startDate: '2026-07-01',
    endDate: '2026-07-01'
  }
}

async function readTravel(id: string) {
  return (await reader.get('/admin/travel').query({ _id: id }).expect(200)).body.data
}

async function readProject(id: string) {
  return (await reader.get('/admin/project').query({ _id: id }).expect(200)).body.data
}

test.before(async () => {
  await loginUser(reader, 'admin')
  await loginUser(ownerReader, 'user')
  owner = (await ownerReader.get('/user').expect(200)).body.data
  await loginUser(agent, 'travel')
  approver = (await agent.get('/user').expect(200)).body.data
  const organisation = (await reader.get('/admin/organisation').expect(200)).body.data[0]
  const projects: ProjectSimple<string>[] = []
  for (const name of ['Supervised project', 'Other project']) {
    const response = await reader
      .post('/admin/project')
      .send({ identifier: `TRAVEL-AUTH-${randomUUID()}`, name, organisation: organisation._id, balance: { amount: 0 } })
      .expect(200)
    projects.push(response.body.result)
  }
  ;[supervisedProject, otherProject] = projects
})

for (const reference of ['id', 'object'] as const) {
  test.serial(`travel creation: restricted approver cannot use another project (${reference})`, async (t) => {
    await setSupervisedProjects([supervisedProject._id])
    const body = travelBody(reference === 'id' ? otherProject._id : { _id: otherProject._id })
    const before = await readProject(otherProject._id)
    const response = await agent.post('/approve/travel/approved').send(body)
    t.is(response.status, 403, JSON.stringify(response.body))
    t.is(response.body.name, 'alerts.notAllowed')
    t.falsy(response.body.result)
    const saved = (await ownerReader.get('/travel').expect(200)).body.data
    t.false(saved.some((travel: { name: string }) => travel.name === body.name))
    t.deepEqual(await readProject(otherProject._id), before)
  })

  test.serial(`travel approval: restricted approver cannot move an application to another project (${reference})`, async (t) => {
    const body = travelBody(supervisedProject._id)
    const created = await ownerReader.post('/travel/appliedFor').send(body).expect(200)
    const id = created.body.result._id as string
    await setSupervisedProjects([supervisedProject._id])
    const before = await readTravel(id)
    const projectsBefore = [await readProject(supervisedProject._id), await readProject(otherProject._id)]
    const response = await agent
      .post('/approve/travel/approved')
      .send({ ...body, _id: id, project: reference === 'id' ? otherProject._id : { _id: otherProject._id } })
    t.is(response.status, 403)
    t.is(response.body.name, 'alerts.notAllowed')
    t.deepEqual(await readTravel(id), before)
    t.deepEqual([await readProject(supervisedProject._id), await readProject(otherProject._id)], projectsBefore)
  })

  for (const restricted of [true, false]) {
    test.serial(
      `travel creation: ${restricted ? 'project-restricted' : 'unrestricted'} approver can use an authorized project (${reference})`,
      async (t) => {
        await setSupervisedProjects(restricted ? [supervisedProject._id] : [])
        const project = restricted ? supervisedProject : otherProject
        const body = travelBody(reference === 'id' ? project._id : { _id: project._id })
        const response = await agent.post('/approve/travel/approved').send(body).expect(200)
        const saved = await readTravel(response.body.result._id)
        t.is(saved.name, body.name)
        t.is(saved.project._id, project._id)
        t.is(saved.owner._id, owner._id)
        t.is(saved.editor._id, approver._id)
        t.is(saved.state, TravelState.APPROVED)
        t.is(saved.reason, body.reason)
        t.is(saved.destinationPlace.country._id, 'DE')
        t.is(saved.destinationPlace.place, 'Berlin')
      }
    )
  }
}

test.serial('travel approval: restricted approver cannot approve an existing application in another project', async (t) => {
  const body = travelBody(otherProject._id)
  const created = await ownerReader.post('/travel/appliedFor').send(body).expect(200)
  const id = created.body.result._id as string
  await setSupervisedProjects([supervisedProject._id])
  const before = await readTravel(id)
  const projectBefore = await readProject(otherProject._id)
  const response = await agent.post('/approve/travel/approved').send({ _id: id })
  t.is(response.status, 403)
  t.is(response.body.name, 'alerts.notAllowed')
  t.deepEqual(await readTravel(id), before)
  t.deepEqual(await readProject(otherProject._id), projectBefore)
})

test.serial('travel approval: restricted approver can approve an existing application in their project', async (t) => {
  const body = travelBody(supervisedProject._id)
  const created = await ownerReader.post('/travel/appliedFor').send(body).expect(200)
  const id = created.body.result._id as string
  await setSupervisedProjects([supervisedProject._id])
  await agent.post('/approve/travel/approved').send({ _id: id }).expect(200)
  const saved = await readTravel(id)
  t.is(saved.project._id, supervisedProject._id)
  t.is(saved.owner._id, owner._id)
  t.is(saved.state, TravelState.APPROVED)
  t.is(saved.destinationPlace.place, 'Berlin')
})

test.serial('travel self-approval uses the separate direct approval permission', async (t) => {
  await reader
    .post('/admin/user')
    .send({
      _id: owner._id,
      access: { ...owner.access, 'approved:travel': true },
      projects: { ...owner.projects, supervised: [supervisedProject._id] }
    })
    .expect(200)
  try {
    await loginUser(ownerReader, 'user')
    const body = travelBody(otherProject._id)
    const response = await ownerReader.post('/travel/approved').send(body).expect(200)
    const saved = await readTravel(response.body.result._id)
    t.is(saved.project._id, otherProject._id)
    t.is(saved.owner._id, owner._id)
    t.is(saved.editor._id, owner._id)
    t.is(saved.state, TravelState.APPROVED)
  } finally {
    await reader.post('/admin/user').send({ _id: owner._id, access: owner.access, projects: owner.projects }).expect(200)
  }
})

test.after.always(async () => {
  await shutdown()
})
