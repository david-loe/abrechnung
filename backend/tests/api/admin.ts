import { User } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import createAgent, { loginUser } from '../_agent.js'

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

test.serial('admin can remove optional bank details while incomplete accounts remain invalid', async (t) => {
  const userId = (await agent.get('/user')).body.data._id
  const account = { accountHolder: 'Synthetic Admin', iban: 'DE89370400440532013000' }
  const added = await agent.post('/admin/user').send({ _id: userId, settings: { bankAccount: account } })
  t.is(added.status, 200)
  t.is(added.body.result.settings.bankAccount.iban, account.iban)
  const incomplete = await agent.post('/admin/user').send({ _id: userId, settings: { bankAccount: { accountHolder: 'Incomplete' } } })
  t.is(incomplete.status, 422)
  const removed = await agent.post('/admin/user').send({ _id: userId, settings: { bankAccount: null } })
  t.is(removed.status, 200)
  t.is(removed.body.result.settings.bankAccount, null)
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
