import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('GET /settings', async (t) => {
  const res = await agent.get('/settings')
  t.is(res.status, 200, JSON.stringify(res.body))
  t.regex(res.body.data.version, /^\d+\.\d+\.\d+/)
  t.is(typeof res.body.data.isReadOnly, 'boolean')
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
