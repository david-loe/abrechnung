import { mock } from 'node:test'
import test from 'ava'
import mongoose from 'mongoose'
import ExchangeRate from '../../models/exchangeRate.js'
import User from '../../models/user.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'
import { seedExchangeRates } from '../_exchangeRates.js'
import { snapshotSharedFixtures } from '../_fixtures.js'

const synchronize = mock.method(mongoose, 'syncIndexes', async () => {
  throw new Error('Test application must not synchronize indexes')
})
const started = performance.now()
const agent = await createAgent()
console.log(`Prepared createAgent: ${Math.round(performance.now() - started)} ms`)

test.serial('prepared applications do not repeat database setup or share sessions', async (t) => {
  t.is(synchronize.mock.callCount(), 0)
  t.is(mongoose.connection.config.autoIndex, false)
  t.is((await agent.get('/auth/authenticated')).status, 401)
  await loginUser(agent, 'user')
  t.is((await agent.get('/auth/authenticated')).status, 200)
  const other = await createAgent()
  t.is((await other.get('/auth/authenticated')).status, 401)
  t.is(synchronize.mock.callCount(), 0)
})

test.serial('shared fixture restoration preserves existing users, settings and activity', async (t) => {
  const original = await User.collection.findOne({ 'fk.ldapauth': 'fry' })
  t.truthy(original)
  if (!original) return
  const restore = await snapshotSharedFixtures()
  try {
    await User.collection.updateOne(
      { _id: original._id },
      { $set: { 'settings.language': 'fr', 'access.admin': true, lastActiveAt: new Date(0) } }
    )
  } finally {
    await restore()
  }
  t.deepEqual(await User.collection.findOne({ _id: original._id }), original)
})

test.serial('exchange-rate fixtures normalize dates and restore existing and newly inserted rates', async (t) => {
  const provider = 'InforEuro' as const
  const date = new Date('2001-02-01T00:00:00.000Z')
  const currency = `fixture-${new mongoose.Types.ObjectId()}`
  const filter = { provider, date, currency }
  const original = { ...filter, rate: 2 }
  await ExchangeRate.collection.insertOne(original)
  try {
    const restore = await seedExchangeRates([
      { ...filter, date: new Date('2001-02-15T12:30:00.000Z'), rate: 3 },
      { ...filter, currency: `${currency}-new`, rate: 4 }
    ])
    t.is((await ExchangeRate.collection.findOne(filter))?.rate, 3)
    t.is((await ExchangeRate.collection.findOne({ ...filter, currency: `${currency}-new` }))?.rate, 4)
    await restore()
    t.is((await ExchangeRate.collection.findOne(filter))?.rate, 2)
    t.is(await ExchangeRate.collection.findOne({ ...filter, currency: `${currency}-new` }), null)
  } finally {
    await ExchangeRate.collection.deleteOne(filter)
  }
})

test.after.always(async () => {
  mock.restoreAll()
  await shutdown()
})
