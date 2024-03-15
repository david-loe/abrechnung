import test from 'ava'
import createAgent, { loginUser } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('GET /healthInsurance', async (t) => {
  const res = await agent.get('/api/healthInsurance')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})
