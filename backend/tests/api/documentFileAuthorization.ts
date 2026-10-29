import { readFile } from 'node:fs/promises'
import { Category, ExpenseReport, HealthCareCost, Travel, User } from 'abrechnung-common/types.js'
import test from 'ava'
import mongoose, { Types } from 'mongoose'
import type request from 'supertest'
import { objectToFormFields } from '../../helper.js'
import DocumentFile from '../../models/documentFile.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const ownerAgent = await createAgent()
const reviewerAgent = await createAgent()
const reader = await createAgent()
const targets = [
  { type: 'expenseReport', record: 'expense' },
  { type: 'healthCareCost', record: 'expense' },
  { type: 'travel', record: 'expense' },
  { type: 'travel', record: 'stage' }
] as const
type Target = (typeof targets)[number]
type Report = ExpenseReport<string> | HealthCareCost<string> | Travel<string>
let projectId: string
let insuranceId: string
let categories: Category<string>[]
let foreignOwner: User<string>
const receiptBytes = await readFile('tests/files/dummy.pdf')
const upload = { name: 'Receipt.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }

function recordBody(target: Target, receipts: unknown[]) {
  const category = categories.find(
    ({ for: value }) => value === (target.type === 'travel' ? 'Travel' : 'ExpenseReport') || value === 'both'
  )
  if (!category) throw new Error('Missing receipt test category')
  const cost = {
    currency: 'EUR',
    date: '2026-07-01',
    positions: [{ kind: 'manual', description: 'Ticket', grossAmount: 20, vatRate: 0, project: projectId, category: category._id }],
    receipts
  }
  return target.record === 'stage'
    ? {
        departure: '2026-07-01T08:00:00Z',
        arrival: '2026-07-01T19:00:00Z',
        startLocation: { country: 'DE', place: 'Berlin' },
        endLocation: { country: 'DE', place: 'Berlin' },
        transport: { type: 'otherTransport' },
        purpose: 'professional',
        cost
      }
    : { description: 'Receipt authorization', cost }
}

function records(target: Target, report: Report) {
  return target.record === 'stage' ? (report as Travel<string>).stages : report.expenses
}

async function postRecord(agent: request.Agent, target: Target, id: string, body: object, multipart = false, examiner = false) {
  let mutation = agent.post(`${examiner ? '/examine' : ''}/${target.type}/${target.record}`).query({ parentId: id })
  if (!multipart) return await mutation.send(body)
  for (const entry of objectToFormFields(body)) {
    mutation = entry.field.endsWith('[data]') ? mutation.attach(entry.field, entry.val) : mutation.field(entry.field, entry.val)
  }
  return await mutation
}

async function createReport(target: Target) {
  const response = await ownerAgent
    .post(`/${target.type}/${target.type === 'travel' ? 'appliedFor' : 'inWork'}`)
    .send({
      name: `Receipt authorization ${new Types.ObjectId()}`,
      project: projectId,
      insurance: insuranceId,
      patientName: 'Example Patient',
      reason: 'Conference',
      destinationPlace: { country: 'DE', place: 'Berlin' },
      startDate: '2026-07-01',
      endDate: '2026-07-01'
    })
    .expect(200)
  const id = response.body.result._id as string
  if (target.type === 'travel') {
    await loginUser(reviewerAgent, 'travel')
    await reviewerAgent.post('/approve/travel/approved').send({ _id: id }).expect(200)
  }
  return id
}

async function foreignReceipt() {
  await loginUser(reviewerAgent, 'expenseReport')
  const report = await reviewerAgent
    .post('/examine/expenseReport/inWork')
    .send({ name: 'Foreign receipt source', project: projectId, owner: foreignOwner._id })
    .expect(200)
  const response = await postRecord(reviewerAgent, targets[0], report.body.result._id, recordBody(targets[0], [upload]), true, true)
  if (response.status !== 200) throw new Error(JSON.stringify(response.body))
  const id = (response.body.result as ExpenseReport<string>).expenses[0].cost.receipts[0]._id
  await reviewerAgent.get('/documentFile').query({ _id: id }).expect(200)
  return id
}

async function details(target: Target, id: string) {
  return (await reader.get(`/admin/${target.type}`).query({ _id: id }).expect(200)).body.data as Report
}

async function storedFileIds() {
  return (await DocumentFile.distinct('_id')).map(String).sort()
}

test.before(async () => {
  await loginUser(ownerAgent, 'user')
  await loginUser(reader, 'admin')
  await loginUser(reviewerAgent, 'expenseReport')
  foreignOwner = (await reviewerAgent.get('/user').expect(200)).body.data
  projectId = (await ownerAgent.get('/project').expect(200)).body.data[0]._id
  insuranceId = (await ownerAgent.get('/healthInsurance').expect(200)).body.data[0]._id
  categories = (await ownerAgent.get('/category').expect(200)).body.data
})

test.serial("JSON references cannot delete another user's receipt through an owned draft", async (t) => {
  const receiptId = await foreignReceipt()
  const id = await createReport(targets[0])
  const before = await details(targets[0], id)
  const response = await postRecord(ownerAgent, targets[0], id, recordBody(targets[0], [{ _id: receiptId }]))
  const after = await details(targets[0], id)
  await ownerAgent.delete('/expenseReport').query({ _id: id }).expect(200)
  const download = await reviewerAgent.get('/documentFile').query({ _id: receiptId })
  t.log({ referenceSaveStatus: response.status, ownerDownloadAfterDraftDeletion: download.status })
  t.is(response.status, 403)
  t.deepEqual(after, before)
  t.is(download.status, 200)
  t.deepEqual(download.body, receiptBytes)
})

for (const target of targets) {
  for (const role of ['owner', 'examiner'] as const) {
    for (const format of ['JSON', 'multipart', 'mixed upload'] as const) {
      test.serial(`${target.type}/${target.record}: ${role} rejects foreign and missing references in ${format}`, async (t) => {
        const foreignId = await foreignReceipt()
        const id = await createReport(target)
        const added = await postRecord(ownerAgent, target, id, recordBody(target, [upload]), true)
        t.is(added.status, 200, JSON.stringify(added.body))
        const original = records(target, added.body.result)[0]
        if (role === 'examiner') await loginUser(reviewerAgent, target.type)
        const agent = role === 'owner' ? ownerAgent : reviewerAgent
        const before = await details(target, id)
        const fileIdsBefore = await storedFileIds()

        for (const invalidId of [foreignId, new Types.ObjectId().toString()]) {
          const receipts = [
            ...(format === 'mixed upload' ? [upload] : []),
            ...original.cost.receipts.map(({ _id }) => ({ _id })),
            { _id: invalidId }
          ]
          const response = await postRecord(
            agent,
            target,
            id,
            { ...recordBody(target, receipts), _id: original._id },
            format !== 'JSON',
            role === 'examiner'
          )
          t.is(response.status, 403, JSON.stringify(response.body))
          t.is(response.body.name, 'alerts.notAllowed')
          t.deepEqual(await details(target, id), before)
          // Rejected mixed requests must not leave files that no report references.
          t.deepEqual(await storedFileIds(), fileIdsBefore)
        }
        const download = await reader.get('/admin/documentFile').query({ _id: foreignId }).expect(200)
        t.deepEqual(download.body, receiptBytes)
      })
    }

    for (const multipart of [false, true]) {
      test.serial(
        `${target.type}/${target.record}: ${role} preserves owned references without uploads in ${multipart ? 'multipart' : 'JSON'}`,
        async (t) => {
          const id = await createReport(target)
          const added = await postRecord(ownerAgent, target, id, recordBody(target, [upload]), true)
          t.is(added.status, 200, JSON.stringify(added.body))
          const original = records(target, added.body.result)[0]
          const receiptId = original.cost.receipts[0]._id
          if (role === 'examiner') await loginUser(reviewerAgent, target.type)
          const response = await postRecord(
            role === 'owner' ? ownerAgent : reviewerAgent,
            target,
            id,
            { ...recordBody(target, [{ _id: receiptId }, { _id: receiptId }]), _id: original._id, note: 'Updated without uploading' },
            multipart,
            role === 'examiner'
          )
          t.is(response.status, 200, JSON.stringify(response.body))
          const saved = records(target, await details(target, id))[0]
          t.is(saved.note, 'Updated without uploading')
          t.deepEqual(
            saved.cost.receipts.map(({ _id }) => _id),
            [receiptId, receiptId]
          )
          t.deepEqual((await ownerAgent.get('/documentFile').query({ _id: receiptId }).expect(200)).body, receiptBytes)
        }
      )
    }
  }

  for (const role of ['owner', 'examiner'] as const) {
    test.serial(
      `${target.type}/${target.record}: ${role} combines an owned reference with a new upload for the report owner`,
      async (t) => {
        const id = await createReport(target)
        const added = await postRecord(ownerAgent, target, id, recordBody(target, [upload]), true)
        t.is(added.status, 200, JSON.stringify(added.body))
        const original = records(target, added.body.result)[0]
        const receiptId = original.cost.receipts[0]._id
        if (role === 'examiner') await loginUser(reviewerAgent, target.type)
        const response = await postRecord(
          role === 'owner' ? ownerAgent : reviewerAgent,
          target,
          id,
          { ...recordBody(target, [{ _id: receiptId }, { ...upload, name: 'New upload.pdf' }]), _id: original._id },
          true,
          role === 'examiner'
        )
        t.is(response.status, 200, JSON.stringify(response.body))
        const receipts = records(target, await details(target, id))[0].cost.receipts
        t.deepEqual(
          receipts.map(({ name }) => name),
          ['Receipt.pdf', 'New upload.pdf']
        )
        t.is(receipts[0]._id, receiptId)
        t.not(receipts[1]._id, receiptId)
        for (const { _id } of receipts) {
          t.deepEqual((await ownerAgent.get('/documentFile').query({ _id }).expect(200)).body, receiptBytes)
        }
      }
    )
  }

  test.serial(
    `${target.type}/${target.record}: deleting a stored foreign reference preserves the foreign file and removes owned files`,
    async (t) => {
      const foreignId = await foreignReceipt()
      const id = await createReport(target)
      const added = await postRecord(ownerAgent, target, id, recordBody(target, [upload]), true)
      t.is(added.status, 200, JSON.stringify(added.body))
      const original = records(target, added.body.result)[0]
      const ownId = original.cost.receipts[0]._id
      const collection = { expenseReport: 'expensereports', healthCareCost: 'healthcarecosts', travel: 'travels' }[target.type]
      // Simulate a cross-owner reference saved by a vulnerable version, using only tracked test fixtures.
      await mongoose.connection
        .collection(collection)
        .updateOne(
          { _id: new Types.ObjectId(id) },
          {
            $set: {
              [`${target.record === 'stage' ? 'stages' : 'expenses'}.0.cost.receipts`]: [
                new Types.ObjectId(ownId),
                new Types.ObjectId(foreignId)
              ]
            }
          }
        )
      await ownerAgent.delete(`/${target.type}`).query({ _id: id }).expect(200)
      await reader.get(`/admin/${target.type}`).query({ _id: id }).expect(404)
      await reader.get('/admin/documentFile').query({ _id: ownId }).expect(404)
      const download = await reader.get('/admin/documentFile').query({ _id: foreignId }).expect(200)
      t.deepEqual(download.body, receiptBytes)
    }
  )
}

test.serial('a valid upload after a skipped JSON-only file retains its original multipart index', async (t) => {
  const id = await createReport(targets[0])
  const body = recordBody(targets[0], [
    { name: 'No upload.pdf', type: 'application/pdf' },
    { ...upload, name: 'Actual upload.pdf' }
  ])
  const response = await postRecord(ownerAgent, targets[0], id, body, true)
  t.is(response.status, 200, JSON.stringify(response.body))
  const receipts = (await details(targets[0], id)).expenses[0].cost.receipts
  t.deepEqual(
    receipts.map(({ name }) => name),
    ['Actual upload.pdf']
  )
  t.deepEqual((await ownerAgent.get('/documentFile').query({ _id: receipts[0]._id }).expect(200)).body, receiptBytes)
})

test.serial('JSON file data cannot create a new receipt without an upload', async (t) => {
  const id = await createReport(targets[0])
  const fileIdsBefore = await storedFileIds()
  const response = await postRecord(ownerAgent, targets[0], id, recordBody(targets[0], [{ ...upload, data: 'not an upload' }]))
  t.is(response.status, 200, JSON.stringify(response.body))
  t.deepEqual((await details(targets[0], id)).expenses[0].cost.receipts, [])
  t.deepEqual(await storedFileIds(), fileIdsBefore)
})

test.serial('vehicle registration references also enforce ownership without an upload', async (t) => {
  const foreignId = await foreignReceipt()
  const before = (await ownerAgent.get('/user').expect(200)).body.data.vehicleRegistration
  await ownerAgent
    .post('/user/vehicleRegistration')
    .send({ vehicleRegistration: [{ _id: foreignId, name: upload.name, type: upload.type }] })
    .expect(403)
  t.deepEqual((await ownerAgent.get('/user').expect(200)).body.data.vehicleRegistration, before)
  t.deepEqual((await reviewerAgent.get('/documentFile').query({ _id: foreignId }).expect(200)).body, receiptBytes)
})

test.serial("organisation logos retain their explicit permission to reference another owner's file without an upload", async (t) => {
  const foreignId = await foreignReceipt()
  const organisation = (await reader.get('/admin/organisation').expect(200)).body.data[0]
  await reader
    .post('/admin/organisation')
    .send({ _id: organisation._id, logo: { _id: foreignId, name: upload.name, type: upload.type } })
    .expect(200)
  const fetched = await reader.get('/admin/organisation').query({ _id: organisation._id }).expect(200)
  t.is(fetched.body.data.logo._id, foreignId)
  await reader
    .post('/admin/organisation')
    .send({ _id: organisation._id, logo: { _id: new Types.ObjectId().toString(), name: upload.name, type: upload.type } })
    .expect(403)
  t.is((await reader.get('/admin/organisation').query({ _id: organisation._id }).expect(200)).body.data.logo._id, foreignId)
})

test.after.always(async () => {
  await shutdown()
})
