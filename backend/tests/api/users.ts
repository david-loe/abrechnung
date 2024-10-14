import test from 'ava'
import { disconnectDB } from '../../db.js'
import createAgent, { loginUser } from './_agent.js'

const agent = await createAgent()

test('GET /users 40X', async (t) => {
  // Should fail because 'user' should have no access
  await loginUser(agent, 'user')
  const res = await agent.get('/users')
  t.not(res.status, 200)
})

test('GET /users', async (t) => {
  await loginUser(agent, 'travel')
  const res = await agent.get('/users')
  t.is(res.status, 200)
})

test.serial.after.always('Drop DB Connection', async (t) => {
  await disconnectDB()
})
