import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()

test.serial('GET /users 40X', async (t) => {
  // Should fail because 'user' should have no access
  await loginUser(agent, 'user')
  const res = await agent.get('/users')
  t.is(res.status, 401)
})

test.serial('GET /users', async (t) => {
  await loginUser(agent, 'travel')
  const res = await agent.get('/users')
  t.is(res.status, 200)
  t.true(res.body.data.length > 0)
  t.true(res.body.data.every(({ _id, email }: { _id: string; email: string }) => typeof _id === 'string' && typeof email === 'string'))
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
