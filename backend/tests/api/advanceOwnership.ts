import { Advance, ExpenseReport, ExpenseReportState, ProjectSimple, User } from 'abrechnung-common/types.js'
import test from 'ava'
import mongoose, { Types } from 'mongoose'
import { objectToFormFields } from '../../helper.js'
import AdvanceModel from '../../models/advance.js'
import DocumentFile from '../../models/documentFile.js'
import ExpenseReportModel from '../../models/expenseReport.js'
import ProjectModel from '../../models/project.js'
import ReportUsage from '../../models/reportUsage.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'
import { seedExchangeRates } from '../_exchangeRates.js'

const agent = await createAgent()
const reportIds: string[] = []
const advanceIds: string[] = []
let project: ProjectSimple<string>
let owner: User<string>
let examiner: User<string>
let insuranceId: string
const additionalReports: { collection: string; id: Types.ObjectId }[] = []
const otherReportTypes = [
  {
    path: 'travel',
    collection: 'travels',
    reviewer: 'travel',
    creation: '/travel/appliedFor',
    examinerCreation: '/approve/travel/approved'
  },
  {
    path: 'healthCareCost',
    collection: 'healthcarecosts',
    reviewer: 'healthCareCost',
    creation: '/healthCareCost/inWork',
    examinerCreation: '/examine/healthCareCost/inWork'
  }
] as const
let restoreProjectBalance: (() => Promise<unknown>) | undefined

async function createAdvance(advanceOwner: User<string>, currency = 'EUR') {
  await loginUser(agent, 'advance')
  const response = await agent
    .post('/approve/advance/approved')
    .send({
      name: 'Ownership regression advance',
      reason: 'Ownership regression',
      owner: advanceOwner._id,
      project: project._id,
      budget: { amount: 1000, currency },
      ...(currency === 'EUR' ? {} : { exchangeRateDate: '2024-05-01' })
    })
  if (response.status !== 200) throw new Error(JSON.stringify(response.body))
  advanceIds.push(response.body.result._id)
  return response.body.result as Advance<string>
}

async function createReport(advances: string[] = [], currency?: string) {
  await loginUser(agent, 'user')
  const response = await agent
    .post('/expenseReport/inWork')
    .send({ name: 'Ownership regression report', project: project._id, advances, currency })
  if (response.body.result?._id) reportIds.push(response.body.result._id)
  return response
}

async function readAdvance(id: string) {
  await loginUser(agent, 'advance')
  const response = await agent.get('/approve/advance').query({ _id: id })
  if (response.status !== 200) throw new Error(JSON.stringify(response.body))
  const advance = response.body.data as Advance<string>
  return {
    budget: advance.budget,
    balance: advance.balance,
    offsetAgainst: advance.offsetAgainst,
    state: advance.state,
    settledOn: advance.settledOn,
    updatedAt: advance.updatedAt
  }
}

test.before(async () => {
  await seedExchangeRates([{ provider: 'Frankfurter', currency: 'USD', date: new Date('2024-05-01'), rate: 0.8 }])
  await loginUser(agent, 'user')
  owner = (await agent.get('/user')).body.data
  project = (await agent.get('/project')).body.data[0]
  insuranceId = (await agent.get('/healthInsurance')).body.data[0]._id
  const originalProject = await ProjectModel.collection.findOne({ _id: new Types.ObjectId(project._id) })
  if (!originalProject) throw new Error('Missing project fixture')
  restoreProjectBalance = async () =>
    ProjectModel.collection.updateOne({ _id: originalProject._id }, { $set: { balance: originalProject.balance } })
  await loginUser(agent, 'expenseReport')
  examiner = (await agent.get('/user')).body.data
})

for (const currency of ['EUR', 'USD']) {
  test.serial(`creating a ${currency} report rejects another owner's advance without exposing its finances`, async (t) => {
    const foreignAdvance = await createAdvance(examiner, currency)
    const before = await readAdvance(foreignAdvance._id)
    const response = await createReport([foreignAdvance._id], currency === 'EUR' ? undefined : currency)
    t.is(response.status, 422)
    t.is(response.body.errors[0].message, 'invalidAdvanceOwner')
    t.falsy(response.body.result)
    t.deepEqual(await readAdvance(foreignAdvance._id), before)
    t.is(
      await ExpenseReportModel.collection.countDocuments({
        _id: { $in: reportIds.map((id) => new Types.ObjectId(id)) },
        advances: new Types.ObjectId(foreignAdvance._id)
      }),
      0
    )
  })
}

for (const endpoint of ['/expenseReport/inWork', '/examine/expenseReport']) {
  test.serial(`${endpoint} rejects a mixed selection and preserves the saved report and both advances`, async (t) => {
    const ownAdvance = await createAdvance(owner)
    const foreignAdvance = await createAdvance(examiner)
    const created = await createReport([ownAdvance._id])
    t.is(created.status, 200)
    const report = created.body.result as ExpenseReport<string>
    const before = await ExpenseReportModel.collection.findOne({ _id: new Types.ObjectId(report._id) })
    const advancesBefore = [await readAdvance(ownAdvance._id), await readAdvance(foreignAdvance._id)]
    await loginUser(agent, endpoint.startsWith('/examine/') ? 'expenseReport' : 'user')
    const response = await agent.post(endpoint).send({ _id: report._id, advances: [ownAdvance._id, foreignAdvance._id] })
    t.is(response.status, 422)
    t.is(response.body.errors[0].message, 'invalidAdvanceOwner')
    t.falsy(response.body.result)
    t.deepEqual(await ExpenseReportModel.collection.findOne({ _id: new Types.ObjectId(report._id) }), before)
    t.deepEqual(await readAdvance(ownAdvance._id), advancesBefore[0])
    t.deepEqual(await readAdvance(foreignAdvance._id), advancesBefore[1])
  })
}

test.serial('examiner-created reports validate advances against the selected owner', async (t) => {
  const ownAdvance = await createAdvance(owner)
  const examinerAdvance = await createAdvance(examiner)
  await loginUser(agent, 'expenseReport')
  const rejected = await agent
    .post('/examine/expenseReport/inWork')
    .send({ owner: owner._id, project: project._id, advances: [examinerAdvance._id] })
  if (rejected.body.result?._id) reportIds.push(rejected.body.result._id)
  t.is(rejected.status, 422)
  t.is(rejected.body.errors[0].message, 'invalidAdvanceOwner')
  t.falsy(rejected.body.result)
  const accepted = await agent
    .post('/examine/expenseReport/inWork')
    .send({ owner: owner._id, project: project._id, advances: [ownAdvance._id] })
  if (accepted.body.result?._id) reportIds.push(accepted.body.result._id)
  t.is(accepted.status, 200)
  t.is(accepted.body.result.advances[0]._id, ownAdvance._id)
})

test.serial('missing and historic advances are rejected instead of silently dropping the relationship', async (t) => {
  const advance = await createAdvance(owner)
  const historicId = new Types.ObjectId()
  advanceIds.push(historicId.toString())
  const source = await AdvanceModel.collection.findOne({ _id: new Types.ObjectId(advance._id) })
  if (!source) throw new Error('Missing advance fixture')
  const { reference: _reference, ...historic } = source
  await AdvanceModel.collection.insertOne({ ...historic, _id: historicId, historic: true })
  for (const id of [new Types.ObjectId().toString(), historicId.toString()]) {
    const response = await createReport([id])
    t.is(response.status, 422)
    t.is(response.body.errors[0].message, 'invalidAdvanceOwner')
    t.falsy(response.body.result)
  }
})

test.serial('an examiner selects the report owner’s advance and review consumes only that balance', async (t) => {
  const ownAdvance = await createAdvance(owner)
  const examinerAdvance = await createAdvance(examiner)
  const examinerBefore = await readAdvance(examinerAdvance._id)
  const created = await createReport()
  t.is(created.status, 200)
  const id = created.body.result._id as string
  await loginUser(agent, 'expenseReport')
  const selected = await agent.post('/examine/expenseReport').send({ _id: id, advances: [ownAdvance._id] })
  t.is(selected.status, 200)
  t.is(selected.body.result.advances[0].balance.amount, 1000)
  t.is(selected.body.result.owner._id, owner._id)
  await loginUser(agent, 'user')
  const categories = await agent.get('/category')
  const category = categories.body.data.find(({ for: value }: { for: string }) => value === 'ExpenseReport' || value === 'both')
  let request = agent.post('/expenseReport/expense').query({ parentId: id })
  for (const entry of objectToFormFields({
    description: 'Ownership expense',
    cost: {
      date: '2024-05-01',
      currency: 'EUR',
      receipts: [{ name: 'Ownership receipt.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }],
      positions: [
        { kind: 'manual', description: 'Ownership expense', grossAmount: 100, vatRate: 0, project: project._id, category: category._id }
      ]
    }
  })) {
    request = entry.field.endsWith('[data]') ? request.attach(entry.field, entry.val) : request.field(entry.field, entry.val)
  }
  const expense = await request
  t.is(expense.status, 200)
  t.is((await agent.post('/expenseReport/underExamination').send({ _id: id })).status, 200)
  await loginUser(agent, 'expenseReport')
  const completed = await agent.post('/examine/expenseReport/reviewCompleted').send({ _id: id })
  t.is(completed.status, 200)
  t.is(completed.body.result.state, ExpenseReportState.REVIEW_COMPLETED)
  const after = await readAdvance(ownAdvance._id)
  t.is(after.balance.amount, 900)
  t.is(after.offsetAgainst.length, 1)
  t.is(after.offsetAgainst[0].reportId, id)
  t.deepEqual(await readAdvance(examinerAdvance._id), examinerBefore)
})

function reportFields(path: string) {
  return path === 'travel'
    ? {
        reason: 'Ownership regression trip',
        destinationPlace: { country: { _id: 'DE' }, place: 'Berlin' },
        startDate: '2024-05-01',
        endDate: '2024-05-03'
      }
    : { patientName: 'Fry', insurance: insuranceId }
}

async function createOtherReport(scenario: (typeof otherReportTypes)[number], advances: string[] = []) {
  await loginUser(agent, 'user')
  const response = await agent
    .post(scenario.creation)
    .send({ name: 'Ownership regression', project: project._id, advances, ...reportFields(scenario.path) })
  if (response.body.result?._id) {
    additionalReports.push({ collection: scenario.collection, id: new Types.ObjectId(response.body.result._id) })
    if (scenario.path === 'travel') {
      await loginUser(agent, 'travel')
      const approved = await agent.post('/approve/travel/approved').send({ _id: response.body.result._id })
      if (approved.status !== 200) throw new Error(JSON.stringify(approved.body))
      return approved
    }
  }
  return response
}

for (const scenario of otherReportTypes) {
  test.serial(`${scenario.path}: creating a report rejects another owner's advance`, async (t) => {
    const foreignAdvance = await createAdvance(examiner)
    const before = await readAdvance(foreignAdvance._id)
    const response = await createOtherReport(scenario, [foreignAdvance._id])
    t.is(response.status, 422)
    t.is(response.body.errors[0].path, 'advances')
    t.is(response.body.errors[0].message, 'invalidAdvanceOwner')
    t.falsy(response.body.result)
    t.deepEqual(await readAdvance(foreignAdvance._id), before)
    t.is(await mongoose.connection.collection(scenario.collection).countDocuments({ advances: new Types.ObjectId(foreignAdvance._id) }), 0)
  })

  for (const asExaminer of [false, true]) {
    test.serial(
      `${scenario.path}: ${asExaminer ? 'examiner' : 'owner'} update rejects mixed selections without changing stored data`,
      async (t) => {
        const ownAdvance = await createAdvance(owner)
        const foreignAdvance = await createAdvance(examiner)
        const created = await createOtherReport(scenario, [ownAdvance._id])
        t.is(created.status, 200)
        const id = new Types.ObjectId(created.body.result._id)
        const collection = mongoose.connection.collection(scenario.collection)
        const before = await collection.findOne({ _id: id })
        const ownBefore = await readAdvance(ownAdvance._id)
        const foreignBefore = await readAdvance(foreignAdvance._id)
        await loginUser(agent, asExaminer ? scenario.reviewer : 'user')
        const response = await agent
          .post(asExaminer ? `/examine/${scenario.path}` : scenario.creation)
          .send({ _id: id.toString(), advances: [ownAdvance._id, foreignAdvance._id] })
        t.is(response.status, 422)
        t.is(response.body.errors[0].message, 'invalidAdvanceOwner')
        t.falsy(response.body.result)
        t.deepEqual(await collection.findOne({ _id: id }), before)
        t.deepEqual(await readAdvance(ownAdvance._id), ownBefore)
        t.deepEqual(await readAdvance(foreignAdvance._id), foreignBefore)
      }
    )
  }

  test.serial(`${scenario.path}: examiner-created reports use the report owner and deduplicate valid selections`, async (t) => {
    await loginUser(agent, scenario.reviewer)
    const reviewer = (await agent.get('/user')).body.data as User<string>
    const ownAdvance = await createAdvance(owner)
    const reviewerAdvance = await createAdvance(reviewer)
    await loginUser(agent, scenario.reviewer)
    const body = { owner: owner._id, project: project._id, ...reportFields(scenario.path) }
    const rejected = await agent.post(scenario.examinerCreation).send({ ...body, advances: [reviewerAdvance._id] })
    if (rejected.body.result?._id)
      additionalReports.push({ collection: scenario.collection, id: new Types.ObjectId(rejected.body.result._id) })
    t.is(rejected.status, 422)
    t.is(rejected.body.errors[0].message, 'invalidAdvanceOwner')
    t.falsy(rejected.body.result)
    const accepted = await agent.post(scenario.examinerCreation).send({ ...body, advances: [ownAdvance._id, ownAdvance._id] })
    if (accepted.body.result?._id)
      additionalReports.push({ collection: scenario.collection, id: new Types.ObjectId(accepted.body.result._id) })
    t.is(accepted.status, 200)
    t.is(accepted.body.result.owner._id, owner._id)
    t.deepEqual(
      accepted.body.result.advances.map(({ _id }: { _id: string }) => _id),
      [ownAdvance._id]
    )
  })

  test.serial(`${scenario.path}: missing and historic selections are rejected`, async (t) => {
    const advance = await createAdvance(owner)
    const historicId = new Types.ObjectId()
    advanceIds.push(historicId.toString())
    const source = await AdvanceModel.collection.findOne({ _id: new Types.ObjectId(advance._id) })
    if (!source) throw new Error('Missing advance fixture')
    const { reference: _reference, ...historic } = source
    await AdvanceModel.collection.insertOne({ ...historic, _id: historicId, historic: true })
    for (const id of [new Types.ObjectId().toString(), historicId.toString()]) {
      const response = await createOtherReport(scenario, [id])
      t.is(response.status, 422)
      t.is(response.body.errors[0].message, 'invalidAdvanceOwner')
      t.falsy(response.body.result)
    }
  })
}

for (const scenario of [{ path: 'expenseReport', collection: 'expensereports', reviewer: 'expenseReport' }, ...otherReportTypes] as const) {
  test.serial(`${scenario.path}: review rejects a stored cross-owner link before changing balances or history`, async (t) => {
    const ownAdvance = await createAdvance(owner)
    const foreignAdvance = await createAdvance(examiner)
    const created =
      scenario.path === 'expenseReport' ? await createReport([ownAdvance._id]) : await createOtherReport(scenario, [ownAdvance._id])
    t.is(created.status, 200)
    const id = new Types.ObjectId(created.body.result._id)
    const collection = mongoose.connection.collection(scenario.collection)
    // Arrange a legacy invalid relationship; only the real HTTP review operation is under test.
    await collection.updateOne(
      { _id: id },
      { $set: { state: ExpenseReportState.IN_REVIEW, advances: [new Types.ObjectId(foreignAdvance._id)] } }
    )
    const before = await collection.findOne({ _id: id })
    const ownBefore = await readAdvance(ownAdvance._id)
    const foreignBefore = await readAdvance(foreignAdvance._id)
    const projectBefore = await ProjectModel.collection.findOne({ _id: new Types.ObjectId(project._id) })
    await loginUser(agent, scenario.reviewer)
    const response = await agent.post(`/examine/${scenario.path}/reviewCompleted`).send({ _id: id.toString() })
    t.is(response.status, 422)
    t.is(response.body.errors[0].message, 'invalidAdvanceOwner')
    t.deepEqual(await collection.findOne({ _id: id }), before)
    t.deepEqual(await readAdvance(ownAdvance._id), ownBefore)
    t.deepEqual(await readAdvance(foreignAdvance._id), foreignBefore)
    t.deepEqual(await ProjectModel.collection.findOne({ _id: new Types.ObjectId(project._id) }), projectBefore)
  })
}

test.serial('travel approval rejects a changed selection before writing history', async (t) => {
  const ownAdvance = await createAdvance(owner)
  const foreignAdvance = await createAdvance(examiner)
  await loginUser(agent, 'user')
  const created = await agent
    .post('/travel/appliedFor')
    .send({ project: project._id, advances: [ownAdvance._id], ...reportFields('travel') })
  t.is(created.status, 200)
  const id = new Types.ObjectId(created.body.result._id)
  additionalReports.push({ collection: 'travels', id })
  const collection = mongoose.connection.collection('travels')
  const before = await collection.findOne({ _id: id })
  await loginUser(agent, 'travel')
  const rejected = await agent
    .post('/approve/travel/approved')
    .send({ _id: id.toString(), owner: owner._id, advances: [foreignAdvance._id] })
  t.is(rejected.status, 422)
  t.is(rejected.body.errors[0].message, 'invalidAdvanceOwner')
  t.deepEqual(await collection.findOne({ _id: id }), before)
  const accepted = await agent.post('/approve/travel/approved').send({ _id: id.toString(), owner: owner._id, advances: [ownAdvance._id] })
  t.is(accepted.status, 200)
  t.is(accepted.body.result.advances[0]._id, ownAdvance._id)
})

test.serial('directly approved own travel validates both creation and subsequent selections', async (t) => {
  const ownAdvance = await createAdvance(owner)
  const foreignAdvance = await createAdvance(examiner)
  await loginUser(agent, 'admin')
  await agent
    .post('/admin/user')
    .send({ _id: owner._id, access: { ...owner.access, 'approved:travel': true } })
    .expect(200)
  try {
    await loginUser(agent, 'user')
    const body = { project: project._id, ...reportFields('travel') }
    const rejected = await agent.post('/travel/approved').send({ ...body, advances: [foreignAdvance._id] })
    if (rejected.body.result?._id) additionalReports.push({ collection: 'travels', id: new Types.ObjectId(rejected.body.result._id) })
    t.is(rejected.status, 422)
    t.is(rejected.body.errors[0].message, 'invalidAdvanceOwner')
    const accepted = await agent.post('/travel/approved').send({ ...body, advances: [ownAdvance._id] })
    t.is(accepted.status, 200)
    const id = new Types.ObjectId(accepted.body.result._id)
    additionalReports.push({ collection: 'travels', id })
    const collection = mongoose.connection.collection('travels')
    const before = await collection.findOne({ _id: id })
    const changed = await agent.post('/travel/approved').send({ _id: id.toString(), advances: [ownAdvance._id, foreignAdvance._id] })
    t.is(changed.status, 422)
    t.is(changed.body.errors[0].message, 'invalidAdvanceOwner')
    t.deepEqual(await collection.findOne({ _id: id }), before)
  } finally {
    await loginUser(agent, 'admin')
    await agent.post('/admin/user').send({ _id: owner._id, access: owner.access }).expect(200)
  }
})

for (const scenario of [{ path: 'expenseReport', collection: 'expensereports', reviewer: 'expenseReport' }, otherReportTypes[1]] as const) {
  test.serial(`${scenario.path}: returning to draft validates advances against a changed report owner`, async (t) => {
    const ownAdvance = await createAdvance(owner)
    const nextOwnerAdvance = await createAdvance(examiner)
    const created =
      scenario.path === 'expenseReport' ? await createReport([ownAdvance._id]) : await createOtherReport(scenario, [ownAdvance._id])
    t.is(created.status, 200)
    const id = new Types.ObjectId(created.body.result._id)
    const collection = mongoose.connection.collection(scenario.collection)
    await collection.updateOne({ _id: id }, { $set: { state: ExpenseReportState.IN_REVIEW } })
    const before = await collection.findOne({ _id: id })
    await loginUser(agent, scenario.reviewer)
    const rejected = await agent.post(`/examine/${scenario.path}/inWork`).send({ _id: id.toString(), owner: examiner._id })
    t.is(rejected.status, 422)
    t.is(rejected.body.errors[0].message, 'invalidAdvanceOwner')
    t.deepEqual(await collection.findOne({ _id: id }), before)
    const accepted = await agent
      .post(`/examine/${scenario.path}/inWork`)
      .send({ _id: id.toString(), owner: examiner._id, advances: [nextOwnerAdvance._id] })
    t.is(accepted.status, 200)
    t.is(accepted.body.result.owner._id, examiner._id)
    t.is(accepted.body.result.advances[0]._id, nextOwnerAdvance._id)
  })
}

test.serial.after.always(async () => {
  try {
    for (const entry of additionalReports) {
      const collection = mongoose.connection.collection(entry.collection)
      const report = await collection.findOne({ _id: entry.id })
      if (!report) continue
      const ids = [report._id, ...report.history]
      await DocumentFile.deleteMany({
        _id: { $in: report.expenses.flatMap(({ cost }: { cost: { receipts: Types.ObjectId[] } }) => cost.receipts) }
      })
      await collection.deleteMany({ _id: { $in: ids } })
      await ReportUsage.deleteMany({ reportId: { $in: ids } })
    }
    const reports = await ExpenseReportModel.collection.find({ _id: { $in: reportIds.map((id) => new Types.ObjectId(id)) } }).toArray()
    const reportAndHistoryIds = reports.flatMap((report) => [report._id, ...report.history])
    const advances = await AdvanceModel.collection.find({ _id: { $in: advanceIds.map((id) => new Types.ObjectId(id)) } }).toArray()
    const advanceAndHistoryIds = advances.flatMap((advance) => [advance._id, ...advance.history])
    const receiptIds = reports.flatMap((report) =>
      report.expenses.flatMap(({ cost }: { cost: { receipts: Types.ObjectId[] } }) => cost.receipts)
    )
    await DocumentFile.deleteMany({ _id: { $in: receiptIds } })
    await ExpenseReportModel.deleteMany({ _id: { $in: reportAndHistoryIds } })
    await AdvanceModel.deleteMany({ _id: { $in: advanceAndHistoryIds } })
    await ReportUsage.deleteMany({ reportId: { $in: [...reportAndHistoryIds, ...advanceAndHistoryIds] } })
  } finally {
    await restoreProjectBalance?.()
    await shutdown()
  }
})
