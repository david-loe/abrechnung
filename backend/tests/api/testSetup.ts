import { mock } from 'node:test'
import test from 'ava'
import mongoose from 'mongoose'
import User from '../../models/user.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'
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

test.after.always(async () => {
  mock.restoreAll()
  await shutdown()
})
