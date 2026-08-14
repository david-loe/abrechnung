import { reportModelNames } from 'abrechnung-common/types.js'
import test from 'ava'
import mongoose, { Model, Types } from 'mongoose'
import { connectDB, disconnectDB } from '../db.js'
import { initializeReferenceCounters, initializeUsersAndProjectsCreationAccess } from '../migrations.js'
import Advance from '../models/advance.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import ReferenceCounter, { nextReference } from '../models/referenceCounter.js'
import Travel from '../models/travel.js'

test.serial.before(async () => {
  await connectDB(false)
})

test.serial('reference allocation is atomic and independent per report model', async (t) => {
  const initialAdvanceReference = await nextReference('Advance')
  const initialTravelReference = await nextReference('Travel')
  const allocatedTravelReferences = await Promise.all(Array.from({ length: 50 }, () => nextReference('Travel')))
  const nextAdvanceReference = await nextReference('Advance')

  t.is(new Set(allocatedTravelReferences).size, allocatedTravelReferences.length)
  t.deepEqual(
    [...allocatedTravelReferences].sort((left, right) => left - right),
    Array.from({ length: 50 }, (_value, index) => initialTravelReference + index + 1)
  )
  t.is(nextAdvanceReference, initialAdvanceReference + 1)
})

test.serial('reference counter migration initializes all models and is idempotent', async (t) => {
  const counters = await ReferenceCounter.find({ _id: { $in: reportModelNames } }).lean()
  const currentMaximum = Math.max(0, ...counters.map((counter) => counter.value))
  const migratedReference = currentMaximum + 1_000
  const reportId = new Types.ObjectId()

  await mongoose.connection.collection('expensereports').insertOne({ _id: reportId, reference: migratedReference, historic: false })
  try {
    await initializeReferenceCounters()
    await initializeReferenceCounters()

    const migratedCounter = await ReferenceCounter.findById('ExpenseReport').lean()
    t.is(migratedCounter?.value, migratedReference)
    t.is(await ReferenceCounter.countDocuments({ _id: { $in: reportModelNames } }), reportModelNames.length)
  } finally {
    await mongoose.connection.collection('expensereports').deleteOne({ _id: reportId })
  }
})

test.serial('creation access migration initializes users and display settings idempotently', async (t) => {
  const userId = new Types.ObjectId()
  const displaySettingsId = new Types.ObjectId()
  await Promise.all([
    mongoose.connection.collection('users').insertOne({ _id: userId, access: {} }),
    mongoose.connection.collection('displaysettings').insertOne({ _id: displaySettingsId, accessIcons: {} })
  ])

  try {
    await initializeUsersAndProjectsCreationAccess()
    await initializeUsersAndProjectsCreationAccess()

    const [user, displaySettings] = await Promise.all([
      mongoose.connection.collection('users').findOne({ _id: userId }),
      mongoose.connection.collection('displaysettings').findOne({ _id: displaySettingsId })
    ])
    t.is(user?.access['create/usersAndProjects'], false)
    t.deepEqual(displaySettings?.accessIcons['create/usersAndProjects'], ['person-plus', 'folder-plus'])
  } finally {
    await Promise.all([
      mongoose.connection.collection('users').deleteOne({ _id: userId }),
      mongoose.connection.collection('displaysettings').deleteOne({ _id: displaySettingsId })
    ])
  }
})

type ReportModel = Model<unknown> & { hydrate(value: Record<string, unknown>): { deleteOne(): Promise<unknown> } }

test.serial('report deletion awaits batched history and receipt cascades', async (t) => {
  const cases: Array<{
    model: ReportModel
    historyCollection: string
    report: (reportId: Types.ObjectId, historyIds: Types.ObjectId[], receiptIds: Types.ObjectId[]) => Record<string, unknown>
  }> = [
    {
      model: Advance as unknown as ReportModel,
      historyCollection: 'advances',
      report: (reportId, historyIds) => ({ _id: reportId, history: historyIds })
    },
    {
      model: Travel as unknown as ReportModel,
      historyCollection: 'travels',
      report: (reportId, historyIds, receiptIds) => ({
        _id: reportId,
        history: historyIds,
        stages: [{ cost: { receipts: [receiptIds[0]] } }],
        expenses: [{ cost: { receipts: [receiptIds[1]] } }]
      })
    },
    {
      model: ExpenseReport as unknown as ReportModel,
      historyCollection: 'expensereports',
      report: (reportId, historyIds, receiptIds) => ({ _id: reportId, history: historyIds, expenses: [{ cost: { receipts: receiptIds } }] })
    },
    {
      model: HealthCareCost as unknown as ReportModel,
      historyCollection: 'healthcarecosts',
      report: (reportId, historyIds, receiptIds) => ({ _id: reportId, history: historyIds, expenses: [{ cost: { receipts: receiptIds } }] })
    }
  ]

  for (const deleteCase of cases) {
    const reportId = new Types.ObjectId()
    const historyIds = [new Types.ObjectId(), new Types.ObjectId()]
    const receiptIds = deleteCase.historyCollection === 'advances' ? [] : [new Types.ObjectId(), new Types.ObjectId()]
    await mongoose.connection
      .collection(deleteCase.historyCollection)
      .insertMany([{ _id: reportId }, ...historyIds.map((_id) => ({ _id, historic: true }))])
    if (receiptIds.length > 0) {
      await mongoose.connection.collection('documentfiles').insertMany(receiptIds.map((_id) => ({ _id })))
    }

    const report = deleteCase.model.hydrate(deleteCase.report(reportId, historyIds, receiptIds))
    await report.deleteOne()

    t.is(await mongoose.connection.collection(deleteCase.historyCollection).countDocuments({ _id: { $in: historyIds } }), 0)
    t.is(await mongoose.connection.collection('documentfiles').countDocuments({ _id: { $in: receiptIds } }), 0)
  }
})

test.serial.after.always(async () => {
  await disconnectDB()
})
