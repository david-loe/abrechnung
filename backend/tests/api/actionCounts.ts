import { type ActionCounts, State } from 'abrechnung-common/types.js'
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test from 'ava'
import { Types } from 'mongoose'
import { shutdown } from '../../app.js'
import Project from '../../models/project.js'
import Travel from '../../models/travel.js'
import User from '../../models/user.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
const reportName = `Action count test ${Date.now()}`

let projectId = ''
let userId = ''
let originalProjects = { assigned: [] as string[], supervised: [] as string[] }

function toIds(entries: Array<{ _id?: string } | string>) {
  return entries.map((entry) => (typeof entry === 'string' ? entry : entry._id)).filter((entry): entry is string => Boolean(entry))
}

test.serial.before(async () => {
  await loginUser(agent, 'admin')
  const projectsResponse = await agent.get('/admin/project')
  const project = projectsResponse.body.data[0]
  const newProjectResponse = await agent
    .post('/admin/project')
    .send({ identifier: `COUNT-${Date.now()}`, name: reportName, organisation: project.organisation, balance: { amount: 0 } })
  projectId = newProjectResponse.body.result._id

  const userResponse = await agent.get('/admin/user').query({ filterJSON: Base64.encode(JSON.stringify({ 'fk.ldapauth': 'zoidberg' })) })
  const user = userResponse.body.data[0]
  userId = user._id
  originalProjects = { assigned: toIds(user.projects.assigned), supervised: toIds(user.projects.supervised) }
  await agent
    .post('/admin/user')
    .send({ _id: userId, access: user.access, projects: { assigned: originalProjects.assigned, supervised: [projectId] } })

  const states = [
    State.APPLIED_FOR,
    State.APPLIED_FOR,
    State.IN_REVIEW,
    State.IN_REVIEW,
    State.IN_REVIEW,
    State.BOOKABLE,
    State.BOOKABLE,
    State.BOOKABLE,
    State.BOOKABLE,
    State.BOOKED
  ]
  await Travel.collection.insertMany([
    ...states.map((state) => ({
      _id: new Types.ObjectId(),
      name: reportName,
      historic: false,
      project: new Types.ObjectId(projectId),
      state
    })),
    { _id: new Types.ObjectId(), name: reportName, historic: true, project: new Types.ObjectId(projectId), state: State.APPLIED_FOR },
    { _id: new Types.ObjectId(), name: reportName, historic: false, project: new Types.ObjectId(), state: State.APPLIED_FOR }
  ])
})

test.serial('GET /user/actionCounts returns only actionable, permitted and project-scoped reports', async (t) => {
  await loginUser(agent, 'travel')
  const response = await agent.get('/user/actionCounts')

  t.is(response.status, 200)
  t.deepEqual(response.body.data as ActionCounts, {
    'approve/advance': 0,
    'approve/travel': 2,
    'examine/travel': 3,
    'examine/expenseReport': 0,
    'examine/healthCareCost': 0,
    'book/advance': 0,
    'book/travel': 4,
    'book/expenseReport': 0,
    'book/healthCareCost': 0
  })
})

test.serial('GET /user/actionCounts does not expose counts without action access', async (t) => {
  await loginUser(agent, 'user')
  const response = await agent.get('/user/actionCounts')

  t.is(response.status, 200)
  t.true(Object.values(response.body.data as ActionCounts).every((count) => count === 0))
})

test.serial.after.always('Clean up action count fixtures', async () => {
  await Travel.collection.deleteMany({ name: reportName })
  if (userId && originalProjects) await User.updateOne({ _id: userId }, { projects: originalProjects })
  if (projectId) await Project.deleteOne({ _id: projectId })
  await shutdown()
})
