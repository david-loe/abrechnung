import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test from 'ava'
import { type Queue } from 'bullmq'
import { shutdown } from '../../app.js'
import { closeIntegrationQueue, type IntegrationJobData, setIntegrationQueueForTests } from '../../integrations/queue.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()

let project: Record<string, unknown>
let category: Record<string, unknown>
let insurance: Record<string, unknown>
let restrictedProject: Record<string, unknown>

setIntegrationQueueForTests({
  add: async () => ({}) as never,
  close: async () => {},
  getJob: async () => undefined,
  getJobSchedulers: async () => [],
  removeJobScheduler: async () => true,
  upsertJobScheduler: async () => ({}) as never
} as unknown as Queue<IntegrationJobData>)

function toIds(entries: Array<{ _id?: string } | string>) {
  return entries.map((entry) => (typeof entry === 'string' ? entry : entry._id)).filter((entry): entry is string => Boolean(entry))
}

async function getAdminUser(username: string) {
  await loginUser(agent, 'admin')
  const response = await agent.get('/admin/user').query({ filterJSON: Base64.encode(JSON.stringify({ 'fk.ldapauth': username })) })
  return response.body.data[0] as {
    _id: string
    access: Record<string, boolean>
    email: string
    projects: { assigned: Array<{ _id: string }>; supervised: Array<{ _id: string }> }
  }
}

async function createAppliedAdvance(name: string, advanceProject = project) {
  await loginUser(agent, 'user')
  const response = await agent
    .post('/advance/appliedFor')
    .send({ name, reason: `${name} reason`, budget: { amount: 1_000, currency: 'USD' }, project: advanceProject })
  return response
}

async function approveAdvance(_id: string) {
  await loginUser(agent, 'advance')
  return await agent.post('/approve/advance/approved').send({ _id })
}

async function createApprovedAdvanceByApprover(name: string, owner: string, advanceProject = project) {
  await loginUser(agent, 'advance')
  return await agent
    .post('/approve/advance/approved')
    .send({ name, owner, project: advanceProject, reason: `${name} reason`, budget: { amount: 250, currency: 'EUR' } })
}

async function deleteApprovedAdvance(_id: string) {
  await loginUser(agent, 'advance')
  return await agent.delete('/approve/advance').query({ _id })
}

test.serial('load shared fixtures', async (t) => {
  await loginUser(agent, 'user')
  const [projectResponse, categoryResponse, insuranceResponse] = await Promise.all([
    agent.get('/project'),
    agent.get('/category'),
    agent.get('/healthInsurance')
  ])

  t.is(projectResponse.status, 200)
  t.is(categoryResponse.status, 200)
  t.is(insuranceResponse.status, 200)

  project = projectResponse.body.data[0]
  category = categoryResponse.body.data[0]
  insurance = insuranceResponse.body.data[0]
})

test.serial('DELETE /approve/advance deletes approved owner advance and mails owner plus project booker', async (t) => {
  const reportName = 'Delete me as approver'
  const createdResponse = await createAppliedAdvance(reportName)
  t.is(createdResponse.status, 200)
  const advance = createdResponse.body.result as { _id: string }

  const approvedResponse = await approveAdvance(advance._id)
  t.is(approvedResponse.status, 200)

  const deleteResponse = await deleteApprovedAdvance(advance._id)
  t.is(deleteResponse.status, 200)
  t.is(deleteResponse.body.deletedCount, 1)

  await loginUser(agent, 'advance')
  const getDeletedResponse = await agent.get('/approve/advance').query({ _id: advance._id })
  t.not(getDeletedResponse.status, 200)
})

test.serial('DELETE /approve/advance deletes approver-created advance and deduplicates mail recipients', async (t) => {
  const advanceUser = await getAdminUser('bender')
  const reportName = 'Approver created advance'
  const createdResponse = await createApprovedAdvanceByApprover(reportName, advanceUser._id)
  t.is(createdResponse.status, 200)
  const advance = createdResponse.body.result as { _id: string }

  const deleteResponse = await deleteApprovedAdvance(advance._id)
  t.is(deleteResponse.status, 200)
  t.is(deleteResponse.body.deletedCount, 1)
})

test.serial('DELETE /approve/advance rejects deletion when linked from expense report', async (t) => {
  const createdResponse = await createAppliedAdvance('Expense report link')
  t.is(createdResponse.status, 200)
  const advance = createdResponse.body.result as { _id: string }

  const approvedResponse = await approveAdvance(advance._id)
  t.is(approvedResponse.status, 200)

  await loginUser(agent, 'user')
  const reportResponse = await agent
    .post('/expenseReport/inWork')
    .send({ name: 'Advance link expense report', project, category, advances: [advance._id] })
  t.is(reportResponse.status, 200)

  const deleteResponse = await deleteApprovedAdvance(advance._id)
  t.is(deleteResponse.status, 409)
})

test.serial('DELETE /approve/advance rejects deletion when linked from health care cost', async (t) => {
  const createdResponse = await createAppliedAdvance('Health care link')
  t.is(createdResponse.status, 200)
  const advance = createdResponse.body.result as { _id: string }

  const approvedResponse = await approveAdvance(advance._id)
  t.is(approvedResponse.status, 200)

  await loginUser(agent, 'user')
  const reportResponse = await agent
    .post('/healthCareCost/inWork')
    .send({ name: 'Advance link health care cost', patientName: 'Philip J. Fry', project, insurance, advances: [advance._id] })
  t.is(reportResponse.status, 200)

  const deleteResponse = await deleteApprovedAdvance(advance._id)
  t.is(deleteResponse.status, 409)
})

test.serial('DELETE /approve/advance rejects deletion when linked from travel', async (t) => {
  const createdResponse = await createAppliedAdvance('Travel link')
  t.is(createdResponse.status, 200)
  const advance = createdResponse.body.result as { _id: string }

  const approvedResponse = await approveAdvance(advance._id)
  t.is(approvedResponse.status, 200)

  await loginUser(agent, 'user')
  const reportResponse = await agent
    .post('/travel/appliedFor')
    .send({
      name: 'Advance link travel',
      reason: 'Conference travel',
      project,
      destinationPlace: { country: { _id: 'DE' }, place: 'Berlin' },
      startDate: new Date('2024-05-01T00:00:00.000Z'),
      endDate: new Date('2024-05-03T00:00:00.000Z'),
      advances: [advance._id]
    })
  t.is(reportResponse.status, 200)

  const deleteResponse = await deleteApprovedAdvance(advance._id)
  t.is(deleteResponse.status, 409)
})

test.serial('DELETE /approve/advance rejects booked advances', async (t) => {
  const createdResponse = await createAppliedAdvance('Booked advance')
  t.is(createdResponse.status, 200)
  const advance = createdResponse.body.result as { _id: string }

  const approvedResponse = await approveAdvance(advance._id)
  t.is(approvedResponse.status, 200)

  await loginUser(agent, 'advance')
  const bookedResponse = await agent.post('/book/advance/booked').send([advance._id])
  t.is(bookedResponse.status, 200)

  const deleteResponse = await deleteApprovedAdvance(advance._id)
  t.not(deleteResponse.status, 200)
})

test.serial('DELETE /approve/advance requires matching project permission', async (t) => {
  const advanceUser = await getAdminUser('bender')

  await loginUser(agent, 'admin')
  const createProjectResponse = await agent
    .post('/admin/project')
    .send({
      identifier: `ADV-DELETE-${Date.now()}`,
      name: 'Restricted advance project',
      organisation: (project as { organisation: unknown }).organisation,
      balance: { amount: 0 }
    })
  t.is(createProjectResponse.status, 200)
  restrictedProject = createProjectResponse.body.result

  const createdResponse = await createAppliedAdvance('Restricted project advance', restrictedProject)
  t.is(createdResponse.status, 200)
  const advance = createdResponse.body.result as { _id: string }

  await loginUser(agent, 'admin')
  const allowApproverResponse = await agent
    .post('/admin/user')
    .send({
      _id: advanceUser._id,
      access: advanceUser.access,
      projects: {
        assigned: toIds(advanceUser.projects.assigned),
        supervised: [...toIds(advanceUser.projects.supervised), (restrictedProject as { _id: string })._id]
      }
    })
  t.is(allowApproverResponse.status, 200)

  const approvedResponse = await approveAdvance(advance._id)
  t.is(approvedResponse.status, 200)

  await loginUser(agent, 'admin')
  const restrictApproverResponse = await agent
    .post('/admin/user')
    .send({
      _id: advanceUser._id,
      access: advanceUser.access,
      projects: { assigned: toIds(advanceUser.projects.assigned), supervised: [(project as { _id: string })._id] }
    })
  t.is(restrictApproverResponse.status, 200)

  const deleteResponse = await deleteApprovedAdvance(advance._id)
  t.not(deleteResponse.status, 200)
})

test.serial.after.always('Drop DB Connection', async () => {
  setIntegrationQueueForTests(undefined)
  await closeIntegrationQueue()
  await shutdown()
})
