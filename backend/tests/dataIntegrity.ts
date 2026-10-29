import test from 'ava'
import mongoose, { Types } from 'mongoose'
import createAgent, { loginUser, shutdown } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')
const project = (await agent.get('/project').expect(200)).body.data[0]
const owner = (await agent.get('/user').expect(200)).body.data._id
const insurance = (await agent.get('/healthInsurance').expect(200)).body.data[0]

function application() {
  return {
    name: `Integrity example ${new Types.ObjectId()}`,
    reason: 'Conference',
    project,
    destinationPlace: { country: 'DE', place: 'Berlin' },
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    budget: { amount: 100, currency: 'EUR' },
    insurance,
    patientName: 'Example Patient'
  }
}

test.serial(
  'given concurrent travel applications, HTTP allocates unique consecutive references independently of advance references',
  async (t) => {
    const initialAdvance = (await agent.post('/advance/appliedFor').send(application()).expect(200)).body.result.reference
    const initialTravel = (await agent.post('/travel/appliedFor').send(application()).expect(200)).body.result.reference
    const responses = await Promise.all(Array.from({ length: 50 }, () => agent.post('/travel/appliedFor').send(application()).expect(200)))
    const references = responses.map(({ body }) => body.result.reference).sort((a, b) => a - b)
    t.deepEqual(
      references,
      Array.from({ length: 50 }, (_, index) => initialTravel + index + 1)
    )
    const nextAdvance = (await agent.post('/advance/appliedFor').send(application()).expect(200)).body.result.reference
    t.is(nextAdvance, initialAdvance + 1)
  }
)

for (const [type, collectionName, state] of [
  ['advance', 'advances', 'appliedFor'],
  ['travel', 'travels', 'appliedFor'],
  ['expenseReport', 'expensereports', 'inWork'],
  ['healthCareCost', 'healthcarecosts', 'inWork']
] as const) {
  test.serial(`${type}: HTTP deletion completes removal of its history and receipts before returning`, async (t) => {
    const response = await agent.post(`/${type}/${state}`).send(application()).expect(200)
    const id = new Types.ObjectId(response.body.result._id)
    const historyIds = [new Types.ObjectId(), new Types.ObjectId()]
    const receiptIds = type === 'advance' ? [] : [new Types.ObjectId(), new Types.ObjectId()]
    const collection = mongoose.connection.collection(collectionName)
    t.teardown(async () => {
      await collection.deleteMany({ _id: { $in: [id, ...historyIds] } })
      await mongoose.connection.collection('documentfiles').deleteMany({ _id: { $in: receiptIds } })
    })
    await collection.insertMany(historyIds.map((_id) => ({ _id, historic: true })))
    if (receiptIds.length)
      await mongoose.connection
        .collection('documentfiles')
        .insertMany(
          receiptIds.map((_id) => ({
            _id,
            owner: new Types.ObjectId(owner),
            name: 'Receipt.pdf',
            type: 'application/pdf',
            data: Buffer.from('receipt')
          }))
        )
    const cost = (ids: Types.ObjectId[]) => ({ currency: 'EUR', date: new Date('2026-07-01'), positions: [], receipts: ids })
    await collection.updateOne(
      { _id: id },
      {
        $set: {
          history: historyIds,
          ...(type === 'travel'
            ? { stages: [{ cost: cost([receiptIds[0]]) }], expenses: [{ description: 'Fixture', cost: cost([receiptIds[1]]) }] }
            : type === 'advance'
              ? {}
              : { expenses: [{ description: 'Fixture', cost: cost(receiptIds) }] })
        }
      }
    )
    await agent.delete(`/${type}`).query({ _id: id.toString() }).expect(200)
    t.is((await agent.get(`/${type}`).query({ _id: id.toString() })).status, 404)
    // Persistence is the external contract of the cascade, not the model's private hooks.
    t.is(await collection.countDocuments({ _id: { $in: historyIds } }), 0)
    t.is(await mongoose.connection.collection('documentfiles').countDocuments({ _id: { $in: receiptIds } }), 0)
  })
}

test.after.always(async () => {
  await shutdown()
})
