import { randomUUID } from 'node:crypto'
import test from 'ava'
import mongoose, { Types } from 'mongoose'
import request from 'supertest'
import { createApp } from '../../app.js'
import { initializeDisplaySettings } from '../../db.js'
import ENV from '../../env.js'
import DisplaySettings from '../../models/displaySettings.js'
import Passkey from '../../models/passkey.js'
import PasskeyChallenge from '../../models/passkeyChallenge.js'
import User from '../../models/user.js'
import createAgent, { loginUser, refreshCsrfToken, shutdown } from '../_agent.js'
import { virtualPasskey } from '../_passkeys.js'

const admin = await createAgent()
await loginUser(admin, 'admin')
const owner = await createAgent()
await loginUser(owner, 'user')
const stranger = await createAgent()
await loginUser(stranger, 'expenseReport')
const app = await createApp()
const origin = new URL(ENV.VITE_FRONTEND_URL).origin
const user = await User.findOne({ 'fk.ldapauth': 'fry' }).orFail()
const settings = await DisplaySettings.findOne().orFail()
const credentials = new Set<string>()
const challenges = new Set<string>()

async function enabled(value: boolean) {
  await admin
    .post('/admin/displaySettings')
    .send({ _id: settings._id, auth: { ...settings.toObject().auth, passkey: value } })
    .expect(200)
}

async function registration(client = owner) {
  const response = await client.post('/user/passkeys/options').send({}).expect(200)
  challenges.add(response.body.result.challengeId)
  return response.body.result as { optionsJSON: { challenge: string; user: { id: string } }; challengeId: string }
}

async function register(name = 'Laptop') {
  const pending = await registration()
  const authenticator = virtualPasskey(pending.optionsJSON.user.id)
  credentials.add(authenticator.id)
  const registered = await owner
    .post('/user/passkeys/verify')
    .send({ challengeId: pending.challengeId, response: authenticator.registration(pending.optionsJSON.challenge), name })
    .expect(200)
  return { authenticator, summary: registered.body.result as { _id: string; name: string } }
}

async function authentication(client = request.agent(app).set('Origin', origin)) {
  const response = await client.post('/auth/passkey/options').send({}).expect(200)
  challenges.add(response.body.challengeId)
  const cookie = (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0]
  return { client, cookie, ...(response.body as { optionsJSON: { challenge: string }; challengeId: string }) }
}

async function listed() {
  return (await owner.get('/user/passkeys').expect(200)).body.data as { _id: string; name: string; lastUsedAt?: string }[]
}

test.beforeEach(async () => {
  await enabled(true)
})
test.after.always(async () => {
  await Passkey.deleteMany({ credentialId: { $in: [...credentials] } })
  await PasskeyChallenge.deleteMany({ _id: { $in: [...challenges] } })
  await shutdown()
})

test.serial('two passkeys independently log in, survive renaming, and deletion revokes only the selected key', async (t) => {
  const first = await register('  Laptop  ')
  const second = await register('Security key')
  t.is(first.summary.name, 'Laptop')
  const list = await listed()
  t.true(list.some(({ _id }) => _id === first.summary._id))
  t.true(list.some(({ _id }) => _id === second.summary._id))
  for (const key of [first, second]) {
    const pending = await authentication()
    const response = await pending.client
      .post('/auth/passkey/verify')
      .send({ challengeId: pending.challengeId, response: key.authenticator.authentication(pending.optionsJSON.challenge) })
      .expect(204)
    t.truthy(response.headers['set-cookie'])
    t.not((response.headers['set-cookie'] as unknown as string[])[0].split(';')[0], pending.cookie)
    const context = await pending.client.get('/auth/authenticated').expect(200)
    t.is(context.body.userId, user._id.toString())
    t.truthy((await listed()).find(({ _id }) => _id === key.summary._id)?.lastUsedAt)
    await refreshCsrfToken(pending.client)
    await pending.client.delete('/auth/logout').expect(204)
  }
  await owner.post(`/user/passkeys/${first.summary._id}`).send({ name: 'Home laptop' }).expect(200)
  t.is((await listed()).find(({ _id }) => _id === first.summary._id)?.name, 'Home laptop')
  await owner.delete(`/user/passkeys/${first.summary._id}`).expect(200)
  t.false((await listed()).some(({ _id }) => _id === first.summary._id))
  const denied = await authentication()
  await denied.client
    .post('/auth/passkey/verify')
    .send({ challengeId: denied.challengeId, response: first.authenticator.authentication(denied.optionsJSON.challenge, { counter: 2 }) })
    .expect(401)
  await denied.client.get('/auth/authenticated').expect(401)
  const allowed = await authentication()
  await allowed.client
    .post('/auth/passkey/verify')
    .send({
      challengeId: allowed.challengeId,
      response: second.authenticator.authentication(allowed.optionsJSON.challenge, { counter: 2 })
    })
    .expect(204)
  t.is((await allowed.client.get('/auth/authenticated')).body.userId, user._id.toString())
})

test.serial('invalid assertions do not authenticate or update the credential', async (t) => {
  const key = await register()
  for (const options of [{ origin: 'https://attacker.invalid' }, { rpID: 'attacker.invalid' }, { verified: false }, { handle: 'wrong' }]) {
    const before = await Passkey.findById(key.summary._id).lean()
    const pending = await authentication()
    await pending.client
      .post('/auth/passkey/verify')
      .send({ challengeId: pending.challengeId, response: key.authenticator.authentication(pending.optionsJSON.challenge, options) })
      .expect(401)
    await pending.client.get('/auth/authenticated').expect(401)
    t.deepEqual(await Passkey.findById(key.summary._id).lean(), before)
  }
  for (const kind of ['signature', 'challenge', 'unknown']) {
    const pending = await authentication()
    const response = key.authenticator.authentication(kind === 'challenge' ? 'another-challenge' : pending.optionsJSON.challenge)
    if (kind === 'signature') response.response.signature = Buffer.alloc(64).toString('base64url')
    if (kind === 'unknown') response.id = Buffer.alloc(32).toString('base64url')
    const before = await Passkey.findById(key.summary._id).lean()
    await pending.client.post('/auth/passkey/verify').send({ challengeId: pending.challengeId, response }).expect(401)
    t.deepEqual(await Passkey.findById(key.summary._id).lean(), before)
    await pending.client.get('/auth/authenticated').expect(401)
  }
})

test.serial('challenge expiration, session binding, replay and concurrent verification are enforced atomically', async (t) => {
  const key = await register()
  const expired = await authentication()
  await PasskeyChallenge.updateOne({ _id: expired.challengeId }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  await expired.client
    .post('/auth/passkey/verify')
    .send({ challengeId: expired.challengeId, response: key.authenticator.authentication(expired.optionsJSON.challenge) })
    .expect(401)
  const pending = await authentication()
  const body = { challengeId: pending.challengeId, response: key.authenticator.authentication(pending.optionsJSON.challenge) }
  await request(app).post('/auth/passkey/verify').set('Origin', origin).send(body).expect(401)
  const responses = await Promise.all([
    pending.client.post('/auth/passkey/verify').send(body),
    pending.client.post('/auth/passkey/verify').send(body)
  ])
  t.deepEqual(responses.map(({ status }) => status).sort(), [204, 401])
  const newLogin = await authentication()
  await newLogin.client.post('/auth/passkey/verify').send(body).expect(401)
  t.is((await Passkey.findById(key.summary._id).orFail()).counter, 1)
})

test.serial('registration validates cryptographic proofs, ownership, duplicate credentials and names', async (t) => {
  const initial = await listed()
  for (const options of [{ origin: 'https://attacker.invalid' }, { rpID: 'attacker.invalid' }, { verified: false }]) {
    const pending = await registration()
    const authenticator = virtualPasskey(pending.optionsJSON.user.id)
    credentials.add(authenticator.id)
    await owner
      .post('/user/passkeys/verify')
      .send({
        challengeId: pending.challengeId,
        response: authenticator.registration(pending.optionsJSON.challenge, options),
        name: 'Invalid'
      })
      .expect(401)
    t.deepEqual(await listed(), initial)
  }
  const key = await register()
  const duplicate = await registration()
  await owner
    .post('/user/passkeys/verify')
    .send({
      challengeId: duplicate.challengeId,
      response: key.authenticator.registration(duplicate.optionsJSON.challenge),
      name: 'Duplicate'
    })
    .expect(409)
  const before = await listed()
  const other = await registration()
  const body = { challengeId: other.challengeId, response: key.authenticator.registration(other.optionsJSON.challenge), name: 'Foreign' }
  await stranger.post('/user/passkeys/verify').send(body).expect(401)
  await stranger.post(`/user/passkeys/${key.summary._id}`).send({ name: 'Stolen' }).expect(404)
  await stranger.delete(`/user/passkeys/${key.summary._id}`).expect(404)
  t.false((await stranger.get('/user/passkeys')).body.data.some(({ _id }: { _id: string }) => _id === key.summary._id))
  for (const name of ['', '   ', 'x'.repeat(101)]) {
    await owner.post(`/user/passkeys/${key.summary._id}`).send({ name }).expect(422)
  }
  t.deepEqual(await listed(), before)
  const publicUser = (await owner.get('/user')).body.data
  t.false(JSON.stringify(publicUser).includes(key.authenticator.id))
})

test.serial('management requires a cookie, trusted origin and session CSRF token', async (t) => {
  const key = await register()
  const before = await listed()
  await request(app).get('/user/passkeys').expect(401)
  await owner.post(`/user/passkeys/${key.summary._id}`).set('X-CSRF-Token', '').send({ name: 'Rejected' }).expect(401)
  await owner.delete(`/user/passkeys/${key.summary._id}`).set('Origin', 'https://attacker.invalid').expect(401)
  await owner.post('/user/passkeys/options').set('X-CSRF-Token', '').send({}).expect(401)
  await request(app).post('/auth/passkey/options').send({}).expect(401)
  await request(app).post('/auth/passkey/options').set('Origin', 'https://attacker.invalid').send({}).expect(401)
  t.deepEqual(await listed(), before)
})

test.serial('global disabling blocks new and pending ceremonies while existing keys remain manageable', async (t) => {
  const key = await register()
  const login = await authentication()
  const pending = await registration()
  await enabled(false)
  await request(app).post('/auth/passkey/options').set('Origin', origin).send({}).expect(501)
  await owner.post('/user/passkeys/options').send({}).expect(501)
  await login.client
    .post('/auth/passkey/verify')
    .send({ challengeId: login.challengeId, response: key.authenticator.authentication(login.optionsJSON.challenge) })
    .expect(501)
  await owner
    .post('/user/passkeys/verify')
    .send({ challengeId: pending.challengeId, response: key.authenticator.registration(pending.optionsJSON.challenge), name: 'Disabled' })
    .expect(501)
  await owner.post(`/user/passkeys/${key.summary._id}`).send({ name: 'Still manageable' }).expect(200)
  t.is((await listed()).find(({ _id }) => _id === key.summary._id)?.name, 'Still manageable')
  await owner.delete(`/user/passkeys/${key.summary._id}`).expect(200)
  t.false((await listed()).some(({ _id }) => _id === key.summary._id))
})

test.serial('inactive and expired accounts cannot log in with a registered passkey', async (t) => {
  const key = await register()
  for (const update of [{ 'access.user': false }, { loseAccessAt: new Date(Date.now() - 1000) }]) {
    const pending = await authentication()
    const before = await Passkey.findById(key.summary._id).lean()
    try {
      await User.updateOne({ _id: user._id }, { $set: update })
      await pending.client
        .post('/auth/passkey/verify')
        .send({ challengeId: pending.challengeId, response: key.authenticator.authentication(pending.optionsJSON.challenge) })
        .expect(401)
      await pending.client.get('/auth/authenticated').expect(401)
      t.deepEqual(await Passkey.findById(key.summary._id).lean(), before)
    } finally {
      await User.updateOne({ _id: user._id }, { $set: { access: user.access }, $unset: { loseAccessAt: '' } })
    }
  }
})

test.serial(
  'fresh installations enable passkeys, upgrades disable them once, and explicit choices survive repeated initialization',
  async (t) => {
    const collection = mongoose.connection.collection(`test-passkey-settings-${randomUUID()}`)
    try {
      await initializeDisplaySettings(collection)
      let stored = await collection.findOne()
      t.true(stored?.auth.passkey)
      await initializeDisplaySettings(collection)
      t.is(await collection.countDocuments(), 1)
      await collection.updateOne({}, { $unset: { 'auth.passkey': '' } })
      await initializeDisplaySettings(collection)
      stored = await collection.findOne()
      t.false(stored?.auth.passkey)
      for (const value of [true, false]) {
        await collection.updateOne({}, { $set: { 'auth.passkey': value } })
        await initializeDisplaySettings(collection)
        t.is((await collection.findOne())?.auth.passkey, value)
      }
    } finally {
      await collection.drop()
    }
  }
)

test.serial('a registration challenge can create exactly one credential even when verified concurrently', async (t) => {
  const pending = await registration()
  const authenticator = virtualPasskey(pending.optionsJSON.user.id)
  credentials.add(authenticator.id)
  const body = { challengeId: pending.challengeId, response: authenticator.registration(pending.optionsJSON.challenge), name: 'Concurrent' }
  const before = await listed()
  const responses = await Promise.all([owner.post('/user/passkeys/verify').send(body), owner.post('/user/passkeys/verify').send(body)])
  t.deepEqual(responses.map(({ status }) => status).sort(), [200, 401])
  await owner.post('/user/passkeys/verify').send(body).expect(401)
  t.is((await listed()).length, before.length + 1)
  t.is(await Passkey.countDocuments({ credentialId: authenticator.id }), 1)
})

test.serial('authenticators with zero counters work while non-increasing positive counters are rejected', async (t) => {
  const key = await register()
  for (const counter of [0, 0, 2]) {
    const pending = await authentication()
    await pending.client
      .post('/auth/passkey/verify')
      .send({ challengeId: pending.challengeId, response: key.authenticator.authentication(pending.optionsJSON.challenge, { counter }) })
      .expect(204)
    t.is((await pending.client.get('/auth/authenticated')).body.userId, user._id.toString())
  }
  const before = await Passkey.findById(key.summary._id).lean()
  for (const counter of [0, 1, 2]) {
    const pending = await authentication()
    await pending.client
      .post('/auth/passkey/verify')
      .send({ challengeId: pending.challengeId, response: key.authenticator.authentication(pending.optionsJSON.challenge, { counter }) })
      .expect(401)
    t.deepEqual(await Passkey.findById(key.summary._id).lean(), before)
    await pending.client.get('/auth/authenticated').expect(401)
  }
})

test.serial('deleting users and merging with deletion revoke their credentials without transferring them', async (t) => {
  const template = await register()
  const saved = await Passkey.findById(template.summary._id).orFail()
  for (const action of ['delete', 'merge']) {
    const id = new Types.ObjectId()
    const created = await admin
      .post('/admin/user')
      .send({ name: { givenName: 'Passkey', familyName: 'Deletion fixture' }, email: `passkey-${id}@example.invalid`, fk: {} })
      .expect(200)
    const target = created.body.result._id as string
    const credentialId = Buffer.from(id.id).toString('base64url')
    credentials.add(credentialId)
    await Passkey.create({ ...saved.toObject(), _id: new Types.ObjectId(), user: target, credentialId })
    if (action === 'delete') await admin.delete('/admin/user').query({ _id: target }).expect(200)
    else
      await admin
        .post('/admin/user/merge')
        .query({ delOverwritten: true })
        .send({ userId: { _id: user._id }, userIdToOverwrite: { _id: target } })
        .expect(200)
    t.is(await User.findById(target), null)
    t.is(await Passkey.countDocuments({ credentialId }), 0)
    t.truthy(await Passkey.findById(template.summary._id))
  }
})
