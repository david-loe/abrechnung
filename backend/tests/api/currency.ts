import test from 'ava'
import createAgent, { loginUser } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('GET /currency', async (t) => {
  const res = await agent.get('/api/currency')
  t.is(res.status, 200)
})
