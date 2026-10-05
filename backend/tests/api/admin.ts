import { User } from 'abrechnung-common/types.js'
import test from 'ava'
import createAgent, { loginUser, shutdown } from '../_agent.js'

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
  const user = (await agent.get('/user')).body.data as User
  const userId = user._id
  const originalBankAccount = user.settings.bankAccount ?? null
  const account = { accountHolder: 'Synthetic Admin', iban: 'DE89370400440532013000' }
  try {
    const added = await agent.post('/admin/user').send({ _id: userId, settings: { bankAccount: account } })
    t.is(added.status, 200)
    t.is(added.body.result.settings.bankAccount.iban, account.iban)
    const incomplete = await agent.post('/admin/user').send({ _id: userId, settings: { bankAccount: { accountHolder: 'Incomplete' } } })
    t.is(incomplete.status, 422)
    const removed = await agent.post('/admin/user').send({ _id: userId, settings: { bankAccount: null } })
    t.is(removed.status, 200)
    t.is(removed.body.result.settings.bankAccount, null)
  } finally {
    const restored = await agent.post('/admin/user').send({ _id: userId, settings: { bankAccount: originalBankAccount } })
    t.is(restored.status, 200)
  }
})

test.serial('last activity is read-only and absent from user forms', async (t) => {
  const user = (await agent.get('/user')).body.data as User
  const response = await agent.post('/admin/user').send({ _id: user._id, lastActiveAt: '2000-01-01T00:00:00Z' })
  t.is(response.status, 200)
  t.is(response.body.result.lastActiveAt, user.lastActiveAt)
  const form = await agent.get('/admin/user/form')
  t.is(form.status, 200)
  t.false('lastActiveAt' in form.body.data)
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
