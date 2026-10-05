import test from 'ava'
import mongoose, { Types } from 'mongoose'
import { disconnectDB } from '../db.js'
import { connectTestDatabase } from './_database.js'

await connectTestDatabase()

function stages(value: unknown) {
  const found: string[] = []
  const pending: unknown[] = [value]
  while (pending.length > 0) {
    const next = pending.pop()
    if (!next || typeof next !== 'object') continue
    const object = next as Record<string, unknown>
    if (typeof object.stage === 'string') found.push(object.stage)
    pending.push(...Object.values(object))
  }
  return found
}

for (const name of ['travels', 'expensereports', 'healthcarecosts', 'advances']) {
  test.serial(`${name} own and administration lists use current-document indexes`, async (t) => {
    const collection = mongoose.connection.collection(name)
    const owner = new Types.ObjectId()
    const dateField = name === 'travels' ? 'startDate' : 'createdAt'
    const fixtures = Array.from({ length: 40 }, (_, index) => ({
      _id: new Types.ObjectId(),
      owner,
      historic: index >= 20,
      [dateField]: new Date(Date.UTC(2090, 0, index + 1)),
      updatedAt: new Date(Date.UTC(2090, 0, index + 1))
    }))
    const indexes = await collection.indexes()
    for (const key of [{ owner: 1, [dateField]: -1 }, { updatedAt: -1 }]) {
      const index = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify(key))
      t.deepEqual(index?.partialFilterExpression, { historic: false })
    }
    await collection.insertMany(fixtures)
    try {
      const current = fixtures
        .filter(({ historic }) => !historic)
        .reverse()
        .slice(0, 5)
        .map(({ _id }) => _id)
      const own = collection
        .find({ owner, historic: false }, { projection: { _id: 1 } })
        .sort({ [dateField]: -1 })
        .limit(5)
      t.deepEqual(
        (await own.toArray()).map(({ _id }) => _id),
        current
      )
      const plan = await own.explain('executionStats')
      t.true(stages(plan.queryPlanner.winningPlan).includes('IXSCAN'))
      t.false(stages(plan.queryPlanner.winningPlan).includes('SORT'))
      t.is(plan.executionStats.totalDocsExamined, 5)
      const administration = collection
        .find({ historic: false }, { projection: { _id: 1 } })
        .sort({ updatedAt: -1 })
        .limit(5)
      const adminPlan = await administration.explain('executionStats')
      t.true(stages(adminPlan.queryPlanner.winningPlan).includes('IXSCAN'))
      t.false(stages(adminPlan.queryPlanner.winningPlan).includes('SORT'))
    } finally {
      await collection.deleteMany({ _id: { $in: fixtures.map(({ _id }) => _id) } })
    }
  })
}

test.after.always(async () => {
  await disconnectDB()
})
