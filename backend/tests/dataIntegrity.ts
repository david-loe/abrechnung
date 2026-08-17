import test from 'ava'
import mongoose, { Model, Types } from 'mongoose'
import { connectDB, disconnectDB } from '../db.js'
import Advance from '../models/advance.js'
import ExpenseReport from '../models/expenseReport.js'
import HealthCareCost from '../models/healthCareCost.js'
import { nextReference } from '../models/referenceCounter.js'
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
