import test from 'ava'
import { User } from '../../../common/types.js'
import { disconnectDB } from '../../db.js'
import createAgent, { loginUser } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')

test('POST /admin/user', async (t) => {
  t.plan(4)
  const res = await agent.get('/user')
  t.is(res.status, 200, 'GET /user')
  const userId = (res.body.data as User)._id
  t.true((res.body.data as User).access.admin)

  const user = { _id: userId, name: { givenName: 'Admin', familyName: 'User' } }
  const res2 = await agent.post('/admin/user').send(user)
  t.is(res2.status, 200)
  t.like(res2.body.result, user)
})

test.serial.after.always('Drop DB Connection', async () => {
  await disconnectDB()
})
