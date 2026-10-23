import { accesses, User } from 'abrechnung-common/types.js'
import test from 'ava'
import DisplaySettings from '../../models/displaySettings.js'
import Settings from '../../models/settings.js'
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

test.serial('user form defaults reflect current permissions and language settings', async (t) => {
  const settings = await Settings.findOne().orFail()
  const displaySettings = await DisplaySettings.findOne().orFail()
  const originalAccess = settings.toObject().defaultAccess
  const originalLanguage = displaySettings.locale.default
  const existingUser = (await agent.get('/user')).body.data as User

  const assertDefaults = async () => {
    const response = await agent.get('/admin/user/form')
    t.is(response.status, 200)
    for (const access of accesses) {
      t.is(response.body.data.access.schema[access].default, settings.defaultAccess[access], access)
    }
    t.is(response.body.data.settings.schema.language.default, displaySettings.locale.default)
  }

  try {
    await assertDefaults()
    for (const access of accesses) {
      settings.defaultAccess[access] = !originalAccess[access]
    }
    displaySettings.locale.default = originalLanguage === 'en' ? 'de' : 'en'
    await settings.save()
    await displaySettings.save()

    await assertDefaults()
    const unchangedUser = (await agent.get('/user')).body.data as User
    t.deepEqual(unchangedUser.access, existingUser.access)
    t.is(unchangedUser.settings.language, existingUser.settings.language)
  } finally {
    settings.defaultAccess = originalAccess
    displaySettings.locale.default = originalLanguage
    await settings.save()
    await displaySettings.save()
  }
})

test.serial('organisation form serializes the empty payout accounts default', async (t) => {
  const response = await agent.get('/admin/organisation/form')
  t.is(response.status, 200)
  t.deepEqual(response.body.data.accountingSettings.schema.payoutAccounts.default, [])
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
