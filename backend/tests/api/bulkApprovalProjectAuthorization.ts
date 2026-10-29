import { randomUUID } from 'node:crypto'
import { AdvanceState, ProjectSimple, TravelState, User } from 'abrechnung-common/types.js'
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const reader = await createAgent()
const ownerReader = await createAgent()
const reportTypes = ['advance', 'travel'] as const
type ReportType = (typeof reportTypes)[number]
let owner: User<string>
let supervisedProject: ProjectSimple<string>
let otherProject: ProjectSimple<string>

async function setSupervisedProjects(type: ReportType, projects: string[]) {
  await loginUser(agent, type)
  const approver = (await agent.get('/user').expect(200)).body.data as User<string>
  await reader
    .post('/admin/user')
    .send({ _id: approver._id, projects: { ...approver.projects, supervised: projects } })
    .expect(200)
  await loginUser(agent, type)
  return approver
}

function importRow(type: ReportType, project: ProjectSimple<string>) {
  return {
    name: `Bulk approval authorization ${randomUUID()}`,
    reason: 'Conference costs',
    owner: owner.email,
    project: project.identifier,
    ...(type === 'advance'
      ? { budget: { amount: 250, currency: 'EUR' } }
      : { destinationPlace: { country: 'DE', place: 'Berlin' }, startDate: '2026-07-01', endDate: '2026-07-01', advances: [] })
  }
}

async function readProjects() {
  return await Promise.all(
    [supervisedProject, otherProject].map(
      async (project) => (await reader.get('/admin/project').query({ _id: project._id }).expect(200)).body.data
    )
  )
}

test.before(async () => {
  await loginUser(reader, 'admin')
  await loginUser(ownerReader, 'user')
  owner = (await ownerReader.get('/user').expect(200)).body.data
  const organisation = (await reader.get('/admin/organisation').expect(200)).body.data[0]
  const projects: ProjectSimple<string>[] = []
  for (const name of ['Supervised import project', 'Other import project']) {
    const response = await reader
      .post('/admin/project')
      .send({ identifier: `BULK-AUTH-${randomUUID()}`, name, organisation: organisation._id, balance: { amount: 0 } })
      .expect(200)
    projects.push(response.body.result)
  }
  ;[supervisedProject, otherProject] = projects
})

for (const type of reportTypes) {
  test.serial(`${type} bulk approval: a mixed-project batch is rejected without creating any reports`, async (t) => {
    await setSupervisedProjects(type, [supervisedProject._id])
    const rows = [importRow(type, supervisedProject), importRow(type, otherProject)]
    const before = await readProjects()
    const response = await agent.post(`/approve/${type}/bulk`).send(rows)
    t.is(response.status, 403)
    t.is(response.body.name, 'alerts.notAllowed')
    t.falsy(response.body.result)
    const stored = await ownerReader
      .get(`/${type}`)
      .query({ filterJSON: Base64.encode(JSON.stringify({ name: { $in: rows.map(({ name }) => name) } })) })
      .expect(200)
    t.deepEqual(stored.body.data, [])
    t.is(stored.body.meta.count, 0)
    t.deepEqual(await readProjects(), before)
  })

  for (const restricted of [true, false]) {
    test.serial(
      `${type} bulk approval: ${restricted ? 'restricted' : 'unrestricted'} approver can import authorized projects`,
      async (t) => {
        const approver = await setSupervisedProjects(type, restricted ? [supervisedProject._id] : [])
        const projects = restricted ? [supervisedProject, supervisedProject] : [supervisedProject, otherProject]
        const rows = projects.map((project) => importRow(type, project))
        const response = await agent.post(`/approve/${type}/bulk`).send(rows).expect(200)
        t.is(response.body.result.length, 2)
        for (const [index, row] of rows.entries()) {
          const saved = (await reader.get(`/admin/${type}`).query({ _id: response.body.result[index]._id }).expect(200)).body.data
          t.is(saved.name, row.name)
          t.is(saved.project._id, projects[index]._id)
          t.is(saved.owner._id, owner._id)
          t.is(saved.editor._id, approver._id)
          t.is(saved.state, type === 'advance' ? AdvanceState.APPROVED : TravelState.APPROVED)
          if (type === 'advance') {
            t.is(saved.budget.amount, 250)
            t.is(saved.balance.amount, 250)
            t.is(saved.balance.currency._id, 'EUR')
          } else {
            t.is(saved.destinationPlace.country._id, 'DE')
            t.is(saved.destinationPlace.place, 'Berlin')
            t.is(saved.startDate, '2026-07-01T00:00:00.000Z')
            t.is(saved.endDate, '2026-07-01T00:00:00.000Z')
          }
        }
      }
    )
  }
}

test.after.always(async () => {
  await shutdown()
})
