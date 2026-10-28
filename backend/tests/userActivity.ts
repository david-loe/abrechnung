import { mock } from 'node:test'
import test from 'ava'
import User from '../models/user.js'
import createAgent, { loginUser, shutdown } from './_agent.js'

const agent = await createAgent()
const now = new Date()
let userId: string

test.before(async () => {
  await loginUser(agent, 'user')
  userId = (await agent.get('/user').expect(200)).body.data._id
})
test.beforeEach(() => mock.timers.enable({ apis: ['Date'], now }))
test.afterEach.always(() => {
  mock.restoreAll()
  mock.timers.reset()
})

for (const initial of ['missing', 'null'] as const) {
  test.serial(`given a ${initial} activity timestamp, an authorized HTTP request records the current time`, async (t) => {
    await User.updateOne({ _id: userId }, initial === 'missing' ? { $unset: { lastActiveAt: '' } } : { $set: { lastActiveAt: null } })
    const response = await agent.get('/user').expect(200)
    t.is(response.body.data.lastActiveAt, now.toISOString())
    t.is((await agent.get('/user').expect(200)).body.data.lastActiveAt, now.toISOString())
  })
}

test.serial('given recent activity, requests retain the timestamp until the exact five-minute boundary', async (t) => {
  const previous = new Date(now.valueOf() - 299_999)
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: previous } })
  t.is((await agent.get('/user').expect(200)).body.data.lastActiveAt, previous.toISOString())
  mock.timers.tick(1)
  t.is((await agent.get('/user').expect(200)).body.data.lastActiveAt, new Date(now.valueOf() + 1).toISOString())
})

test.serial('given a future timestamp, login and authorized requests never move it backwards', async (t) => {
  const future = new Date(now.valueOf() + 1000)
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: future } })
  await loginUser(agent, 'user')
  t.is((await agent.get('/user').expect(200)).body.data.lastActiveAt, future.toISOString())
})

test.serial('given stale activity, parallel authorized requests converge on the same persisted timestamp', async (t) => {
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date(now.valueOf() - 600_000) } })
  const responses = await Promise.all([agent.get('/user').expect(200), agent.get('/user').expect(200)])
  t.true(responses.some(({ body }) => body.data.lastActiveAt === now.toISOString()))
  t.is((await agent.get('/user').expect(200)).body.data.lastActiveAt, now.toISOString())
})

test.serial('given an activity-store outage, an authorized request and login still succeed', async (t) => {
  const previous = new Date(now.valueOf() - 600_000)
  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: previous } })
  // Fault injection at the database boundary; authentication and HTTP remain real.
  const failure = mock.method(User, 'updateOne', async () => {
    throw new Error('Expected activity database outage')
  })
  try {
    t.is((await agent.get('/user').expect(200)).body.data.lastActiveAt, previous.toISOString())
    await loginUser(agent, 'user')
    t.is((await agent.get('/auth/authenticated').expect(200)).body.userId, userId)
  } finally {
    failure.mock.restore()
  }
  t.is((await agent.get('/user').expect(200)).body.data.lastActiveAt, now.toISOString())
})

test.after.always(async () => {
  await shutdown()
})
