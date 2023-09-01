import test from 'ava'
import agent from './_agent.js'

test('GET /currency', async (t) => {
  const res = await agent.get('/api/currency')
  t.is(res.status, 200)
})
