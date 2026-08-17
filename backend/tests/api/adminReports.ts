import { AdvanceState, ExpenseReportState, HealthCareCostState, ReportModelName, TravelState } from 'abrechnung-common/types.js'
import test from 'ava'
import { mongo, Types } from 'mongoose'
import { shutdown } from '../../app.js'
import Advance from '../../models/advance.js'
import DocumentFile from '../../models/documentFile.js'
import ExpenseReport from '../../models/expenseReport.js'
import HealthCareCost from '../../models/healthCareCost.js'
import Project from '../../models/project.js'
import Travel from '../../models/travel.js'
import User from '../../models/user.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
const owner = await User.findOne({ 'fk.ldapauth': 'leela' })
const project = await Project.findOne()

if (!owner || !project) {
  throw new Error('Admin report tests require a user and project fixture')
}

const searchTerm = 'adminvisibilityprobe'
const reportFixtures: {
  model: typeof Travel | typeof ExpenseReport | typeof HealthCareCost | typeof Advance
  type: ReportModelName
  state: number
}[] = [
  { model: Travel, type: 'Travel', state: TravelState.APPLIED_FOR },
  { model: ExpenseReport, type: 'ExpenseReport', state: ExpenseReportState.IN_WORK },
  { model: HealthCareCost, type: 'HealthCareCost', state: HealthCareCostState.BOOKED },
  { model: Advance, type: 'Advance', state: AdvanceState.APPROVED }
]
const reportIds = reportFixtures.map(() => new Types.ObjectId())
const historicalTravelId = new Types.ObjectId()

for (const [index, fixture] of reportFixtures.entries()) {
  await fixture.model.collection.insertOne({
    _id: reportIds[index],
    name: `${searchTerm} ${fixture.type}`,
    reference: 9_900_000 + index,
    owner: owner._id,
    editor: owner._id,
    project: project._id,
    state: fixture.state,
    historic: false
  })
}

await Travel.collection.insertOne({
  _id: historicalTravelId,
  name: `${searchTerm} historical`,
  reference: 9_900_100,
  owner: owner._id,
  editor: owner._id,
  project: project._id,
  state: TravelState.APPLIED_FOR,
  historic: true
})

const documentFileId = new Types.ObjectId()
await DocumentFile.collection.insertOne({
  _id: documentFileId,
  name: 'admin-report-receipt.pdf',
  type: 'application/pdf',
  data: new mongo.Binary(Buffer.from('receipt')),
  owner: owner._id
})

test.serial('admin search includes every current report without workflow permissions', async (t) => {
  await loginUser(agent, 'admin')
  const response = await agent.get('/search').query({ term: searchTerm, limit: 50 })

  t.is(response.status, 200)
  t.is(response.body.meta.count, reportFixtures.length)
  t.deepEqual(
    new Set(response.body.data.map((report: { _reportModelName: ReportModelName }) => report._reportModelName)),
    new Set(reportFixtures.map(({ type }) => type))
  )
})

test.serial('admin reference lookup includes foreign reports regardless of status', async (t) => {
  await loginUser(agent, 'admin')
  const response = await agent.get('/search/ref').query({ ref: 9_900_000, type: 'Travel' })

  t.is(response.status, 200)
  t.is(response.body.data._id, reportIds[0].toString())
})

test.serial('non-admin search permissions remain unchanged', async (t) => {
  await loginUser(agent, 'user')
  const searchResponse = await agent.get('/search').query({ term: searchTerm, limit: 50 })
  const referenceResponse = await agent.get('/search/ref').query({ ref: 9_900_000, type: 'Travel' })

  t.is(searchResponse.status, 200)
  t.is(searchResponse.body.meta.count, 0)
  t.is(referenceResponse.status, 404)
})

test.serial('admin can read current report details for every report type', async (t) => {
  await loginUser(agent, 'admin')

  for (const [index, fixture] of reportFixtures.entries()) {
    const endpoint = `/admin/${fixture.type[0].toLowerCase()}${fixture.type.slice(1)}`
    const response = await agent.get(endpoint).query({ _id: reportIds[index].toString() })
    t.is(response.status, 200, endpoint)
    t.is(response.body.data._id, reportIds[index].toString(), endpoint)
    t.is(response.body.data.owner._id, owner._id.toString(), `${endpoint} owner`)
    t.is(response.body.data.project._id, project._id.toString(), `${endpoint} project`)
  }
})

test.serial('admin read endpoints exclude historic reports and reject non-admins', async (t) => {
  await loginUser(agent, 'admin')
  const historicalResponse = await agent.get('/admin/travel').query({ _id: historicalTravelId.toString() })
  const fileResponse = await agent.get('/admin/documentFile').query({ _id: documentFileId.toString() })

  t.is(historicalResponse.status, 404)
  t.is(fileResponse.status, 200)

  await loginUser(agent, 'user')
  t.is((await agent.get('/admin/travel').query({ _id: reportIds[0].toString() })).status, 401)
  t.is((await agent.get('/admin/documentFile').query({ _id: documentFileId.toString() })).status, 401)
})

test.serial.after.always('clean up admin report fixtures', async () => {
  await Promise.all([
    ...reportFixtures.map((fixture, index) => fixture.model.collection.deleteOne({ _id: reportIds[index] })),
    Travel.collection.deleteOne({ _id: historicalTravelId }),
    DocumentFile.deleteOne({ _id: documentFileId })
  ])
  await shutdown()
})
