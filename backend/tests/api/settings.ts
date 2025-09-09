import test from 'ava'
import { disconnectDB } from '../../db.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('GET /settings', async (t) => {
  const res = await agent.get('/settings')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial.after.always('Drop DB Connection', async () => {
  await disconnectDB()
})
