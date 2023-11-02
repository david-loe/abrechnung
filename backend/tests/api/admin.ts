import test from 'ava'
import { User } from '../../../common/types.js'
import createAgent, { loginUser } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')

test('POST /admin/user', async (t) => {
  t.plan(4)
  const res = await agent.get('/api/user')
  t.is(res.status, 200, 'GET /user')
  const userId = (res.body.data as User)._id
  t.true((res.body.data as User).access.admin)

  const user = { _id: userId, access: { admin: true, 'examine/travel': true, 'examine/expenseReport': true, 'approve/travel': true } }
  const res2 = await agent.post('/api/admin/user').send(user)
  t.is(res2.status, 200)
  t.like(res2.body.result, user)
})
