import test from 'ava'
import { User } from '../../../common/types.js'
import createAgent, { loginAdmin } from './_agent.js'

const agent = createAgent()
await loginAdmin(agent)

test('POST /admin/user', async (t) => {
  t.plan(4)
  const res = await agent.get('/api/user')
  t.is(res.status, 200, 'GET /user')
  const userId = (res.body.data as User)._id
  t.true((res.body.data as User).access.admin)

  const user = { _id: userId, access: { admin: true, examine: true, approve: true } }
  const res2 = await agent.post('/api/admin/user').send(user)
  t.is(res2.status, 200)
  t.like(res2.body.result, user)
})
