import test from 'ava'
import createAgent, { loginUser } from './_agent.js'

const agent = createAgent()
await loginUser(agent)

test('GET /currency', async (t) => {
  const res = await agent.get('/api/currency')
  t.is(res.status, 200)
})
