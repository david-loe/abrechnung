import assert from 'node:assert/strict'
import { AuthContext, User } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import request from 'supertest'
import { createApp } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import UserModel from '../../models/user.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

import { step } from '../_scenario.js'

test.serial('given an authenticated user, activity, personal settings and session rotation preserve the account contract', async (t) => {
  t.timeout(120_000)
  const agent = await createAgent()
  t.teardown(async () => {
    await shutdown()
  })
  await loginUser(agent, 'user')
  let initialCacheScope = ''

  await step(t, 'POST /auth/ldapauth', async (t) => {
    const res = await agent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })
    t.is(res.status, 204, JSON.stringify(res.body))
  })

  await step(t, 'GET /user', async (t) => {
    const res = await agent.get('/user')
    t.is(res.status, 200, JSON.stringify(res.body))
  })

  await step(t, 'login and session activity are persisted with a five-minute interval', async (t) => {
    const current = (await agent.get('/user')).body.data as User
    t.truthy(current.lastActiveAt)
    t.is((await agent.get('/user')).body.data.lastActiveAt, current.lastActiveAt)
    const previous = new Date(Date.now() - 600_000)
    await UserModel.updateOne({ _id: current._id }, { $set: { lastActiveAt: previous } })
    const active = (await agent.get('/user')).body.data as User
    assert(active.lastActiveAt)
    t.true(new Date(active.lastActiveAt).valueOf() > previous.valueOf())
    t.deepEqual((await UserModel.findById(current._id))?.lastActiveAt, new Date(active.lastActiveAt))

    const recent = new Date(Date.now() - 1000)
    await UserModel.updateOne({ _id: current._id }, { $set: { lastActiveAt: recent } })
    t.is((await agent.post('/auth/ldapauth').send({ username: 'professor', password: 'wrong' })).status, 401)
    t.deepEqual((await UserModel.findById(current._id))?.lastActiveAt, recent)
    t.is((await agent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })).status, 204)
    const loggedIn = await UserModel.findById(current._id).orFail()
    assert(loggedIn.lastActiveAt)
    t.true(new Date(loggedIn.lastActiveAt).valueOf() > recent.valueOf())
  })

  for (const activity of ['session activity', 'login']) {
    await step(t, `${activity} replaces an explicitly null activity timestamp`, async (t) => {
      const activityAgent = await createAgent()
      await loginUser(activityAgent, 'admin')
      const current = (await activityAgent.get('/user')).body.data as User
      await UserModel.updateOne({ _id: current._id }, { $set: { lastActiveAt: null } })
      t.true((await UserModel.findById(current._id))?.lastActiveAt === null)

      const startedAt = Date.now()
      if (activity === 'login') {
        t.is((await activityAgent.delete('/auth/logout')).status, 204)
        t.is((await activityAgent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })).status, 204)
      } else {
        t.is((await activityAgent.get('/user')).status, 200)
      }

      const updated = await UserModel.findById(current._id).orFail()
      assert(updated.lastActiveAt instanceof Date)
      t.true(updated.lastActiveAt.valueOf() >= startedAt)
      const response = await activityAgent.get('/user')
      t.is(response.status, 200)
      t.is(response.body.data.lastActiveAt, updated.lastActiveAt.toISOString())
    })
  }

  await step(t, 'personal API key activity is persisted and throttled', async (t) => {
    const current = (await agent.get('/user')).body.data as User
    const keyResponse = await agent.post('/user/httpBearer')
    t.is(keyResponse.status, 200)
    const key = keyResponse.body.result as string
    const api = request(await createApp())
    const previous = new Date(Date.now() - 600_000)
    try {
      await UserModel.updateOne({ _id: current._id }, { $set: { lastActiveAt: previous } })
      const invalid = await api.get('/user').auth(`${current._id}:invalid`, { type: 'bearer' })
      t.is(invalid.status, 401)
      t.deepEqual((await UserModel.findById(current._id))?.lastActiveAt, previous)
      const response = await api.get('/user').auth(key, { type: 'bearer' })
      t.is(response.status, 200)
      t.true(new Date(response.body.data.lastActiveAt).valueOf() > previous.valueOf())
      const next = await api.get('/user').auth(key, { type: 'bearer' })
      t.is(next.body.data.lastActiveAt, response.body.data.lastActiveAt)
    } finally {
      await UserModel.updateOne({ _id: current._id }, { $unset: { 'fk.httpBearer': '' } })
    }
  })

  await step(t, 'concurrent HTTP activity and later settings saves preserve the newest activity timestamp', async (t) => {
    const current = (await agent.get('/user').expect(200)).body.data as User
    await UserModel.updateOne({ _id: current._id }, { $unset: { lastActiveAt: '' } })
    const responses = await Promise.all([agent.get('/user').expect(200), agent.get('/user').expect(200)])
    t.true(responses.some(({ body }) => body.data.lastActiveAt))
    const newer = new Date(Date.now() + 1000)
    await UserModel.updateOne({ _id: current._id }, { $set: { lastActiveAt: newer } })
    await agent.post('/user/settings').send({ language: current.settings.language }).expect(200)
    t.is((await agent.get('/user').expect(200)).body.data.lastActiveAt, newer.toISOString())
  })

  await step(t, 'GET /auth/authenticated returns the offline cache context', async (t) => {
    const res = await agent.get('/auth/authenticated')
    t.is(res.status, 200)
    const context = res.body as AuthContext
    t.regex(context.userId, /^[0-9a-f]{24}$/)
    t.truthy(context.permissions.user)
    t.true(Date.parse(context.expiresAt) > Date.now())
    t.truthy(context.cacheScope)
    initialCacheScope = context.cacheScope
  })

  await step(t, 'cache scope remains stable for legacy access objects and changes with permissions', async (t) => {
    const current = (await agent.get('/user')).body.data as User
    const filter = { _id: new Types.ObjectId(current._id) }
    await UserModel.collection.updateOne(filter, { $unset: { 'access._id': '' } })
    const first = (await agent.get('/auth/authenticated')).body as AuthContext
    const second = (await agent.get('/auth/authenticated')).body as AuthContext
    t.is(second.cacheScope, first.cacheScope)
    t.deepEqual(second.permissions, first.permissions)
    t.false('_id' in second.permissions)

    const previous = current.access['create/usersAndProjects'] === true
    try {
      await UserModel.collection.updateOne(filter, { $set: { 'access.create/usersAndProjects': !previous } })
      const changed = (await agent.get('/auth/authenticated')).body as AuthContext
      t.not(changed.cacheScope, first.cacheScope)
      t.is(changed.permissions['create/usersAndProjects'], !previous)
    } finally {
      await UserModel.collection.updateOne(filter, { $set: { 'access.create/usersAndProjects': previous } })
    }
    t.is(((await agent.get('/auth/authenticated')).body as AuthContext).cacheScope, first.cacheScope)
  })

  await step(t, 'GET /user/token', async (t) => {
    const res = await agent.get('/user/token')
    t.is(res.status, 200, JSON.stringify(res.body))
  })

  await step(t, 'POST /user/token', async (t) => {
    t.plan(3)
    const res = await agent.post('/user/token')
    t.is(res.status, 200, JSON.stringify(res.body))
    t.true('_id' in res.body.result)
    t.deepEqual(res.body.result.files, [])
  })

  await step(t, 'DELETE /user/token', async (t) => {
    const res = await agent.delete('/user/token')
    t.is(res.status, 204, JSON.stringify(res.body))
  })

  await step(t, 'POST /user/settings', async (t) => {
    t.plan(3)
    const settings = { language: 'en', lastCurrencies: [{ _id: 'EUR' }], lastCountries: [{ _id: 'DE' }] }
    const res = await agent.post('/user/settings').send(settings)
    t.is(res.status, 200, JSON.stringify(res.body))
    const res2 = await agent.get('/user')
    t.is(res2.status, 200, 'GET /user')
    t.like(res2.body.data.settings, settings)
  })

  await step(t, 'POST /user/settings normalizes and validates the current user bank account', async (t) => {
    const res = await agent
      .post('/user/settings')
      .send({ bankAccount: { accountHolder: 'Philip J. Fry', iban: 'de89 3704 0044 0532 0130 00', bic: 'cobadeff' } })
    t.is(res.status, 200)
    t.is(res.body.result.bankAccount.iban, 'DE89370400440532013000')
    t.is(res.body.result.bankAccount.bic, 'COBADEFF')
    t.is(
      (await agent.post('/user/settings').send({ bankAccount: { accountHolder: 'Philip J. Fry', iban: 'DE89370400440532013001' } })).status,
      422
    )
    const removeResponse = await agent.post('/user/settings').send({ bankAccount: null })
    t.is(removeResponse.status, 200)
    t.is(removeResponse.body.result.bankAccount, null)
  })

  const vehicleRegistration = { vehicleRegistration: [{ name: 'dummy.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }] }

  await step(t, 'POST /user/vehicleRegistration', async (t) => {
    t.plan(2)
    let req = agent.post('/user/vehicleRegistration')
    for (const entry of objectToFormFields(vehicleRegistration)) {
      if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
        req = req.attach(entry.field, entry.val)
      } else {
        req = req.field(entry.field, entry.val)
      }
    }
    const res = await req
    t.is(res.status, 200, JSON.stringify(res.body))
    const res2 = await agent.get('/documentFile').query({ _id: (res.body.result as User).vehicleRegistration?.[0]._id })
    t.is(res2.status, 200, 'GET /documentFile')
  })

  await step(t, 'POST /user/vehicleRegistration allows clearing all files', async (t) => {
    t.plan(2)
    const res = await agent.post('/user/vehicleRegistration').field('noop', '1')
    t.is(res.status, 200)

    const res2 = await agent.get('/user')
    t.is((res2.body.data as User).vehicleRegistration?.length ?? 0, 0)
  })

  await step(t, 'DELETE /auth/logout destroys the session and rotates the cache scope after login', async (t) => {
    const logoutResponse = await agent.delete('/auth/logout')
    t.is(logoutResponse.status, 204)
    t.is((await agent.get('/auth/authenticated')).status, 401)

    const loginResponse = await agent.post('/auth/ldapauth').send({ username: 'fry', password: 'fry' })
    t.is(loginResponse.status, 204)
    const newContext = (await agent.get('/auth/authenticated')).body as AuthContext
    t.not(newContext.cacheScope, initialCacheScope)
  })
})
