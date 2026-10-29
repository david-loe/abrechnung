import test, { type ExecutionContext } from 'ava'
import mongoose, { Types } from 'mongoose'
import type { Test } from 'supertest'
import { objectToFormFields } from '../../helper.js'
import Advance from '../../models/advance.js'
import Project from '../../models/project.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const reportTypes = ['travel', 'expenseReport', 'healthCareCost', 'advance'] as const
type ReportType = (typeof reportTypes)[number]
type StartingState = 'applied' | 'draft' | 'review' | 'ready'
const modelNames = { travel: 'Travel', expenseReport: 'ExpenseReport', healthCareCost: 'HealthCareCost', advance: 'Advance' } as const

function multipart(request: Test, body: object) {
  for (const entry of objectToFormFields(body)) {
    request = entry.field.endsWith('[data]') ? request.attach(entry.field, entry.val) : request.field(entry.field, entry.val)
  }
  return request
}

async function fixture(t: ExecutionContext, type: ReportType, state: StartingState) {
  await loginUser(agent, 'user')
  const owner = (await agent.get('/user').expect(200)).body.data._id as string
  const project = (await agent.get('/project').expect(200)).body.data[0]
  const projectBefore = await Project.findById(project._id).lean().orFail()
  const categories = (await agent.get('/category').expect(200)).body.data
  const category = categories.find(
    (value: { for: string }) => value.for === (type === 'travel' ? 'Travel' : 'ExpenseReport') || value.for === 'both'
  )
  const insurance = (await agent.get('/healthInsurance').expect(200)).body.data[0]
  const name = `Historical report ${new Types.ObjectId()}`
  const body = {
    name,
    reason: 'Conference',
    project,
    insurance,
    patientName: 'Example Patient',
    destinationPlace: { country: 'DE', place: 'Berlin' },
    startDate: '2026-07-01',
    endDate: '2026-07-01',
    budget: { amount: 1000, currency: 'EUR' }
  }
  await loginUser(agent, 'advance')
  const advance = (
    await agent
      .post('/approve/advance/approved')
      .send({ ...body, owner })
      .expect(200)
  ).body.result
  await loginUser(agent, 'user')
  const creation = type === 'travel' || type === 'advance' ? 'appliedFor' : 'inWork'
  const created = (
    await agent
      .post(`/${type}/${creation}`)
      .send({ ...body, advances: [advance._id] })
      .expect(200)
  ).body.result
  const id = new Types.ObjectId(created._id)
  const collection = mongoose.model(modelNames[type]).collection
  const historicalId = new Types.ObjectId()
  t.teardown(async () => {
    const reportIds = [id, historicalId, new Types.ObjectId(advance._id)]
    await collection.deleteOne({ _id: historicalId })
    await mongoose.connection.collection('reportusages').deleteMany({ reportId: { $in: reportIds } })
    await mongoose.connection.collection('approvedtravels').deleteMany({ reportId: { $in: reportIds } })
  })

  const cost = {
    date: '2026-07-01',
    currency: 'EUR',
    positions: [{ kind: 'manual', description: 'Train ticket', grossAmount: 100, vatRate: 0, project, category }],
    receipts: [{ name: `${name}.pdf`, type: 'application/pdf', data: 'tests/files/dummy.pdf' }]
  }
  const expense = { description: 'Train ticket', cost }
  const bulkExpense = {
    ...expense,
    cost: { ...cost, positions: cost.positions.map((position) => ({ ...position, project: project._id, category: category._id })) }
  }
  const stage = {
    departure: '2026-07-01T08:00:00Z',
    arrival: '2026-07-01T09:00:00Z',
    startLocation: { country: 'DE', place: 'Berlin' },
    endLocation: { country: 'DE', place: 'Berlin' },
    transport: { type: 'otherTransport' },
    purpose: 'professional',
    cost
  }
  if (state !== 'applied') {
    if (type === 'travel') {
      await loginUser(agent, 'travel')
      await agent.post('/approve/travel/approved').send({ _id: id.toString() }).expect(200)
      await loginUser(agent, 'user')
    }
    if (type !== 'advance') {
      await multipart(agent.post(`/${type}/expense`).query({ parentId: id.toString() }), expense).expect(200)
      if (type === 'travel') await multipart(agent.post('/travel/stage').query({ parentId: id.toString() }), stage).expect(200)
      if (state === 'review' || state === 'ready') {
        await agent.post(`/${type}/underExamination`).send({ _id: id.toString() }).expect(200)
      }
    }
    if (state === 'ready') {
      await loginUser(agent, type)
      await agent
        .post(type === 'advance' ? '/approve/advance/approved' : `/examine/${type}/reviewCompleted`)
        .send({ _id: id.toString() })
        .expect(200)
    }
  }
  const current = await collection.findOne({ _id: id })
  if (!current) throw new Error('Missing current report fixture')
  const historical = { ...current, _id: historicalId, historic: true, reference: 9_000_000_000_000 + current.reference }
  await collection.insertOne(historical)
  return {
    type,
    id,
    historicalId,
    current,
    historical,
    collection,
    advanceId: new Types.ObjectId(advance._id),
    projectBalanceBefore: projectBefore.balance.amount as number,
    expense,
    bulkExpense,
    stage,
    name
  }
}

async function storedState(report: Awaited<ReturnType<typeof fixture>>) {
  const ids = [report.id, report.historicalId]
  return {
    reports: await report.collection
      .find({ _id: { $in: [...ids, ...report.current.history] } })
      .sort({ _id: 1 })
      .toArray(),
    project: await mongoose.connection.collection('projects').findOne({ _id: report.current.project }),
    advance: await Advance.collection.findOne({ _id: report.advanceId }),
    receipts: await mongoose.connection
      .collection('documentfiles')
      .find({ name: `${report.name}.pdf` })
      .sort({ _id: 1 })
      .toArray(),
    usage: await mongoose.connection
      .collection('reportusages')
      .find({ reportId: { $in: ids } })
      .sort({ _id: 1 })
      .toArray(),
    approved: await mongoose.connection
      .collection('approvedtravels')
      .find({ reportId: { $in: ids } })
      .sort({ _id: 1 })
      .toArray()
  }
}

for (const type of reportTypes) {
  const states: StartingState[] = type === 'advance' ? ['applied', 'ready'] : ['draft', 'review', 'ready']
  if (type === 'travel') states.unshift('applied')
  for (const state of states) {
    test.serial(`${type}: historical ${state} reports reject operational writes without changing stored data`, async (t) => {
      const report = await fixture(t, type, state)
      const id = report.historicalId.toString()
      const before = await storedState(report)
      async function rejected(request: Test, status = 403) {
        const response = await request
        t.is(response.status, status, `${request.method} ${request.url}: ${JSON.stringify(response.body)}`)
        t.deepEqual(await storedState(report), before)
      }

      await loginUser(agent, 'user')
      if (type === 'advance') {
        if (state === 'applied') {
          await rejected(
            agent
              .post('/advance/appliedFor')
              .send({ _id: id, name: 'Changed', reason: 'Conference', budget: { amount: 1000, currency: 'EUR' } })
          )
          await rejected(agent.delete('/advance').query({ _id: id }))
        } else {
          await rejected(agent.post('/advance/received').send({ _id: id, receivedOn: '2026-07-01' }))
        }
      } else {
        if (state === 'applied' || state === 'draft') {
          await rejected(agent.delete(`/${type}`).query({ _id: id }))
        }
        if (type === 'travel' && (state === 'applied' || state === 'draft')) {
          await rejected(agent.post('/travel/appliedFor').send({ _id: id, name: 'Changed' }))
        }
        if (state === 'draft' || state === 'review') {
          await rejected(agent.post(`/${type}/${type === 'travel' ? 'approved' : 'inWork'}`).send({ _id: id, name: 'Changed' }))
          if (state === 'draft') {
            await rejected(agent.post(`/${type}/underExamination`).send({ _id: id }))
            if (type === 'travel') await rejected(agent.post('/travel').send({ _id: id, days: [] }))
            for (const element of type === 'travel' ? (['expense', 'stage'] as const) : (['expense'] as const)) {
              const body = element === 'stage' ? report.stage : report.expense
              const elementId = report.current[element === 'stage' ? 'stages' : 'expenses'][0]._id.toString()
              await rejected(multipart(agent.post(`/${type}/${element}`).query({ parentId: id }), body))
              await rejected(multipart(agent.post(`/${type}/${element}`).query({ parentId: id }), { ...body, _id: elementId }))
              await rejected(agent.delete(`/${type}/${element}`).query({ parentId: id, _id: elementId }))
            }
            if (type === 'expenseReport') {
              await rejected(agent.post('/expenseReport/expense/bulk').query({ parentId: id }).send([report.bulkExpense]), 404)
            }
          }
        }
      }

      await loginUser(agent, type)
      const base = type === 'advance' ? '/approve/advance' : `/examine/${type}`
      if (type === 'advance' || state === 'draft') await rejected(agent.delete(base).query({ _id: id }))
      if ((type === 'advance' || type === 'travel') && state === 'applied') {
        await rejected(agent.post(`/approve/${type}/approved`).send({ _id: id }))
        await rejected(agent.post(`/approve/${type}/rejected`).send({ _id: id }))
      }
      if ((type === 'travel' && state === 'draft') || (type === 'advance' && state === 'ready')) {
        await rejected(agent.post(`/approve/${type}/withdrawApproval`).send({ _id: id }))
      }
      if (type === 'advance' && state === 'ready') {
        await rejected(agent.post('/approve/advance/offset').send({ advanceId: id, amount: 10, subject: 'Historical correction' }), 404)
      }
      if (type !== 'advance' && (state === 'draft' || state === 'review')) {
        await rejected(agent.post(base).send({ _id: id, name: 'Changed' }))
        if (state === 'draft') {
          await rejected(agent.post(`${base}/underExamination`).send({ _id: id }))
          for (const element of type === 'travel' ? (['expense', 'stage'] as const) : (['expense'] as const)) {
            const body = element === 'stage' ? report.stage : report.expense
            const elementId = report.current[element === 'stage' ? 'stages' : 'expenses'][0]._id.toString()
            await rejected(multipart(agent.post(`${base}/${element}`).query({ parentId: id }), body))
            await rejected(multipart(agent.post(`${base}/${element}`).query({ parentId: id }), { ...body, _id: elementId }))
            await rejected(agent.delete(`${base}/${element}`).query({ parentId: id, _id: elementId }))
          }
          if (type === 'expenseReport') {
            await rejected(agent.post(`${base}/expense/bulk`).query({ parentId: id }).send([report.bulkExpense]), 404)
          }
        } else {
          await rejected(agent.post(`${base}/${type === 'travel' ? 'approved' : 'inWork'}`).send({ _id: id }))
          await rejected(agent.post(`${base}/reviewCompleted`).send({ _id: id }))
        }
      }
      if (state === 'ready') {
        await rejected(agent.post(`/book/${type}/booked`).send([id]))
        await rejected(agent.post(`/book/${type}/bookingExportPreview`).send([id]), 404)
        await rejected(
          agent.post(`/book/${type}/bookingExportPackage`).send({ reports: [id], executionDate: '2026-08-01', bankAccounts: [] }),
          404
        )
        const mixed = await agent.post(`/book/${type}/booked`).send([id, report.id.toString()]).expect(200)
        t.deepEqual(
          mixed.body.result.map((entry: { status: string }) => entry.status),
          ['rejected', 'fulfilled']
        )
        t.deepEqual(await report.collection.findOne({ _id: report.historicalId }), report.historical)
        t.is((await report.collection.findOne({ _id: report.id }))?.state, 40)
      }
    })
  }

  test.serial(`${type}: admin tools exclude historical reports retaining a reference number`, async (t) => {
    const report = await fixture(t, type, type === 'advance' ? 'applied' : 'draft')
    const before = await storedState(report)
    await loginUser(agent, 'admin')
    const reference = { ref: report.historical.reference, type: modelNames[type] }
    await agent.get('/admin/tools/report/ref').query(reference).expect(404)
    await agent
      .post('/admin/tools/report')
      .send({ ...reference, data: { name: 'Changed' } })
      .expect(404)
    await agent.delete('/admin/tools/report').query(reference).expect(404)
    t.deepEqual(await storedState(report), before)
    const currentReference = { ref: report.current.reference, type: modelNames[type] }
    await agent
      .post('/admin/tools/report')
      .send({ ...currentReference, data: { name: 'Current report updated' } })
      .expect(200)
    t.is((await agent.get('/admin/tools/report/ref').query(currentReference).expect(200)).body.data.name, 'Current report updated')
  })

  test.serial(`${type}: saving historical accounting-state documents has no financial or usage effects`, async (t) => {
    const report = await fixture(t, type, 'ready')
    const before = await storedState(report)
    const historical = await mongoose.model(modelNames[type]).findById(report.historicalId).orFail()
    historical.name = 'Saved historical snapshot'
    await historical.save()
    const after = await storedState(report)
    t.is((await report.collection.findOne({ _id: report.historicalId }))?.name, 'Saved historical snapshot')
    t.deepEqual(after.project, before.project)
    t.deepEqual(after.advance, before.advance)
    t.deepEqual(after.receipts, before.receipts)
    t.deepEqual(after.usage, before.usage)
    t.deepEqual(after.approved, before.approved)
    // The current report completed its normal workflow before the snapshot was saved.
    t.is((await report.collection.findOne({ _id: report.id }))?.state, 30)
    t.true(before.usage.some(({ reportId }) => reportId.equals(report.id)))
    if (type !== 'advance') {
      t.is(before.advance?.balance.amount, type === 'travel' ? 800 : 900)
      t.is(before.advance?.offsetAgainst.length, 1)
      t.is(before.project?.balance.amount, report.projectBalanceBefore + (type === 'travel' ? 200 : 100))
    }
  })

  test.serial(`${type}: a historical document cannot create another history entry`, async (t) => {
    const report = await fixture(t, type, type === 'advance' ? 'applied' : 'draft')
    const before = await storedState(report)
    const historical = await mongoose.model(modelNames[type]).findById(report.historicalId).orFail()
    await t.throwsAsync(historical.saveToHistory(), { message: /not found while saving to history/ })
    t.deepEqual(await storedState(report), before)
  })
}

test.serial('travel: stage import rejects historical source and target reports', async (t) => {
  const report = await fixture(t, 'travel', 'draft')
  const before = await storedState(report)
  await loginUser(agent, 'user')
  for (const ids of [
    { sourceTravelId: report.historicalId.toString(), targetTravelId: report.id.toString() },
    { sourceTravelId: report.id.toString(), targetTravelId: report.historicalId.toString() }
  ]) {
    await agent.post('/travel/stage/import').send(ids).expect(404)
    t.deepEqual(await storedState(report), before)
  }
})

test.serial('travel: saving a historical approved snapshot does not publish an approved travel', async (t) => {
  const report = await fixture(t, 'travel', 'draft')
  const before = await storedState(report)
  const historical = await mongoose.model('Travel').findById(report.historicalId).orFail()
  historical.name = 'Saved approved snapshot'
  await historical.save()
  const after = await storedState(report)
  t.deepEqual(after.approved, before.approved)
  t.deepEqual(after.usage, before.usage)
  t.deepEqual(after.project, before.project)
  t.deepEqual(after.advance, before.advance)
})

test.serial('advance: offsetting a historical document preserves the balance and returns the unspent amount', async (t) => {
  const report = await fixture(t, 'advance', 'ready')
  const before = await storedState(report)
  const advance = await Advance.findById(report.historicalId).orFail()
  const remaining = await advance.offset({ amount: 100, currency: advance.balance.currency }, 'offsetEntry', null, 'Historical offset')
  t.is(remaining.amount, 100)
  t.deepEqual(await storedState(report), before)
})

test.after.always(async () => {
  await shutdown()
})
