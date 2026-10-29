import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('GET /currency', async (t) => {
  const res = await agent.get('/currency')
  t.is(res.status, 200, JSON.stringify(res.body))
  t.true(res.body.data.some(({ _id }: { _id: string }) => _id === 'EUR'))
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
