import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('GET /healthInsurance', async (t) => {
  const res = await agent.get('/healthInsurance')
  t.is(res.status, 200, JSON.stringify(res.body))
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
