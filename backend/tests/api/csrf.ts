import { randomInt } from 'node:crypto'
import { ExpenseReportState } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import request from 'supertest'
import { createApp } from '../../app.js'
import ENV from '../../env.js'
import DisplaySettings from '../../models/displaySettings.js'
import ExpenseReport from '../../models/expenseReport.js'
import Project from '../../models/project.js'
import User from '../../models/user.js'
import createAgent, { shutdown } from '../_agent.js'
import { queueFixture } from '../_queue.js'

await createAgent()
const app = await createApp()
const origin = new URL(ENV.VITE_FRONTEND_URL).origin
const backendOrigin = new URL(ENV.VITE_BACKEND_URL).origin
const owner = await User.findOne({ 'fk.ldapauth': 'leela' }).orFail()
const attacker = await User.findOne({ 'fk.ldapauth': 'fry' }).orFail()
const project = await Project.findOne().orFail()
const reportId = new Types.ObjectId()
const reference = randomInt(100_000_000, 1_000_000_000)
const sessions: { send: ReturnType<typeof cookieRequests>; token: string }[] = []

// Replay the actual signed cookie explicitly, including in HTTPS/proxy runs.
// Supertest's HTTP cookie jar would otherwise discard Secure cookies.
function cookieRequests(cookie: string) {
  return (method: 'get' | 'post' | 'delete', path: string) =>
    request(app)[method](path).set('Cookie', cookie).set('X-Forwarded-Proto', 'https')
}

async function login(username = 'professor') {
  const response = await request(app)
    .post('/auth/ldapauth')
    .set('Origin', origin)
    .set('X-Forwarded-Proto', 'https')
    .send({ username, password: username })
    .expect(204)
  const cookies = response.headers['set-cookie'] as unknown as string[]
  const send = cookieRequests(cookies.map((cookie) => cookie.split(';')[0]).join('; '))
  const csrf = await send('get', '/auth/csrf').expect(200)
  const client = { send, token: csrf.body.csrfToken as string }
  sessions.push(client)
  return { ...client, cookies }
}

async function currentReport(client: Awaited<ReturnType<typeof login>>) {
  const response = await client.send('get', '/admin/tools/report/ref').query({ ref: reference, type: 'ExpenseReport' }).expect(200)
  return response.body.data as { owner: { _id: string }; name: string }
}

const changeOwner = { ref: reference, type: 'ExpenseReport', data: { owner: { _id: attacker._id.toString() } } }

test.beforeEach(async () => {
  await ExpenseReport.collection.replaceOne(
    { _id: reportId },
    {
      _id: reportId,
      name: 'CSRF ownership example',
      reference,
      owner: owner._id,
      editor: owner._id,
      project: project._id,
      state: ExpenseReportState.IN_WORK,
      historic: false,
      expenses: [],
      currency: 'EUR'
    },
    { upsert: true }
  )
})

test.serial('foreign form submissions cannot transfer report ownership or expose it to the attacker', async (t) => {
  const admin = await login()
  const thief = await login('fry')
  const before = await currentReport(admin)
  const denied = await admin
    .send('post', '/admin/tools/report')
    .set('Origin', 'https://attacker.invalid')
    .type('form')
    .send(`ref=${reference}&type=ExpenseReport&data[owner][_id]=${attacker._id}`)
  t.is(denied.status, 401)
  t.deepEqual(await currentReport(admin), before)
  const reports = await thief
    .send('get', '/expenseReport')
    .query({ filterJSON: Buffer.from(JSON.stringify({ _id: reportId })).toString('base64') })
  t.is(reports.status, 200)
  t.deepEqual(reports.body.data, [])
})

test.serial('both the session token and an exact trusted Origin are required for report updates', async (t) => {
  const admin = await login()
  const otherSession = await login()
  const before = await currentReport(admin)
  const cases = [
    { origin, token: undefined },
    { origin, token: 'a'.repeat(43) },
    { origin, token: 'invalid' },
    { origin, token: 'a'.repeat(44) },
    { origin, token: otherSession.token },
    { origin: undefined, token: admin.token },
    { origin: 'null', token: admin.token },
    { origin: 'https://attacker.invalid', token: admin.token },
    { origin: `${origin}.attacker.invalid`, token: admin.token },
    { origin: `${origin}/`, token: admin.token },
    { origin: `${origin}:12345`, token: admin.token }
  ]
  for (const example of cases) {
    const mutation = admin.send('post', '/admin/tools/report')
    if (example.origin !== undefined) mutation.set('Origin', example.origin)
    if (example.token !== undefined) mutation.set('X-CSRF-Token', example.token)
    t.is((await mutation.send(changeOwner)).status, 401, JSON.stringify(example))
    t.deepEqual(await currentReport(admin), before)
  }
  const changed = await admin.send('post', '/admin/tools/report').set('Origin', origin).set('X-CSRF-Token', admin.token).send(changeOwner)
  t.is(changed.status, 200)
  t.is((await currentReport(admin)).owner._id, attacker._id.toString())
  t.is((await currentReport(admin)).name, before.name)
})

test.serial('body or query tokens cannot authorize cookie writes, but the configured backend Origin can', async (t) => {
  const admin = await login()
  for (const mutation of [
    admin.send('post', '/admin/tools/report').query({ csrfToken: admin.token }).send(changeOwner),
    admin.send('post', '/admin/tools/report').send({ ...changeOwner, csrfToken: admin.token })
  ]) {
    t.is((await mutation.set('Origin', origin)).status, 401)
    t.is((await currentReport(admin)).owner._id, owner._id.toString())
  }
  await admin
    .send('post', '/admin/tools/report')
    .set('Origin', backendOrigin)
    .set('X-CSRF-Token', admin.token)
    .send(changeOwner)
    .expect(200)
  t.is((await currentReport(admin)).owner._id, attacker._id.toString())
})

test.serial('tokens are private, stable within a session and invalid after logout and another login', async (t) => {
  t.is((await request(app).get('/auth/csrf')).status, 401)
  const admin = await login()
  const repeated = await admin.send('get', '/auth/csrf').set('Origin', origin).expect(200)
  t.regex(admin.token, /^[A-Za-z0-9_-]{43}$/)
  t.is(repeated.body.csrfToken, admin.token)
  t.is(repeated.headers['cache-control'], 'no-store')
  t.is(repeated.headers['access-control-allow-origin'], origin)
  const foreign = await admin.send('get', '/auth/csrf').set('Origin', 'https://attacker.invalid').expect(200)
  t.false('access-control-allow-origin' in foreign.headers)
  if (ENV.VITE_BACKEND_URL.startsWith('https') && ENV.TRUST_PROXY) {
    t.true(admin.cookies.some((cookie) => cookie.includes('Secure') && cookie.includes('SameSite=None')))
  }
  t.is((await admin.send('delete', '/auth/logout').set('Origin', origin)).status, 401)
  t.is((await admin.send('get', '/auth/authenticated')).status, 200)
  await admin.send('delete', '/auth/logout').set('Origin', origin).set('X-CSRF-Token', admin.token).expect(204)
  t.is((await admin.send('get', '/auth/csrf')).status, 401)
  const next = await login()
  t.not(next.token, admin.token)
  const rejected = await next.send('post', '/admin/tools/report').set('Origin', origin).set('X-CSRF-Token', admin.token).send(changeOwner)
  t.is(rejected.status, 401)
  t.is((await currentReport(next)).owner._id, owner._id.toString())
})

test.serial(
  'valid bearer credentials work without CSRF headers and invalid bearer credentials cannot bypass cookie protection',
  async (t) => {
    const admin = await login()
    const response = await admin.send('post', '/user/httpBearer').set('Origin', origin).set('X-CSRF-Token', admin.token).expect(200)
    const token = response.body.result as string
    const denied = await admin.send('post', '/admin/tools/report').auth(`${owner._id}:invalid`, { type: 'bearer' }).send(changeOwner)
    t.is(denied.status, 401)
    t.is((await currentReport(admin)).owner._id, owner._id.toString())
    // A valid bearer also works when an ambient cookie accompanies it.
    await admin.send('post', '/admin/tools/report').auth(token, { type: 'bearer' }).send(changeOwner).expect(200)
    t.is((await currentReport(admin)).owner._id, attacker._id.toString())
    await request(app)
      .post('/admin/tools/report')
      .auth(token, { type: 'bearer' })
      .send({ ref: reference, type: 'ExpenseReport', data: { owner: { _id: owner._id.toString() } } })
      .expect(200)
    t.is((await currentReport(admin)).owner._id, owner._id.toString())
    t.is((await request(app).get('/auth/csrf').auth(token, { type: 'bearer' })).status, 401)
  }
)

test.serial('multipart mutations require the token and regular users cannot gain admin permissions with one', async (t) => {
  const user = await login('fry')
  const before = (await user.send('get', '/user').expect(200)).body.data.vehicleRegistration
  const denied = await user.send('post', '/user/vehicleRegistration').set('Origin', origin).field('noop', '1')
  t.is(denied.status, 401)
  t.deepEqual((await user.send('get', '/user').expect(200)).body.data.vehicleRegistration, before)
  const changed = await user
    .send('post', '/user/vehicleRegistration')
    .set('Origin', origin)
    .set('X-CSRF-Token', user.token)
    .field('noop', '1')
  t.is(changed.status, 200)
  t.deepEqual((await user.send('get', '/user').expect(200)).body.data.vehicleRegistration, [])
  const forbidden = await user.send('post', '/admin/tools/report').set('Origin', origin).set('X-CSRF-Token', user.token).send(changeOwner)
  t.is(forbidden.status, 401)
  t.is(String((await ExpenseReport.collection.findOne({ _id: reportId }))?.owner), owner._id.toString())
})

test.serial('login POSTs require a trusted Origin but no CSRF token, even without a session', async (t) => {
  const lastActiveAt = (await User.findById(owner._id).lean())?.lastActiveAt
  for (const path of ['/auth/ldapauth', '/auth/magiclogin']) {
    for (const source of [undefined, 'null', 'https://attacker.invalid', `${origin}.attacker.invalid`]) {
      const loginRequest = request(app).post(path)
      if (source !== undefined) loginRequest.set('Origin', source)
      const response = await loginRequest.send({ username: 'leela', password: 'leela', destination: owner.email })
      t.is(response.status, 401)
      t.false('set-cookie' in response.headers)
      t.deepEqual((await User.findById(owner._id).lean())?.lastActiveAt, lastActiveAt)
    }
  }
  const user = await login('leela')
  t.is((await user.send('get', '/user').expect(200)).body.data._id, owner._id.toString())
})

test.serial('only a trusted Origin can enqueue a magic login email, without needing a CSRF token', async (t) => {
  const queue = queueFixture(t)
  const admin = await login()
  const settings = await DisplaySettings.findOne().lean().orFail()
  const originalIdentity = (await User.collection.findOne({ _id: owner._id }))?.fk.magiclogin
  const destination = `csrf-${reportId}@example.invalid`
  try {
    await User.collection.updateOne({ _id: owner._id }, { $set: { 'fk.magiclogin': destination } })
    await admin
      .send('post', '/admin/displaySettings')
      .set('Origin', origin)
      .set('X-CSRF-Token', admin.token)
      .send({ _id: settings._id, auth: { ...settings.auth, magiclogin: true } })
      .expect(200)
    await request(app).post('/auth/magiclogin').set('Origin', 'https://attacker.invalid').send({ destination }).expect(401)
    t.is(await queue.count(), 0)
    await request(app).post('/auth/magiclogin').set('Origin', origin).send({ destination }).expect(200)
    const jobs = await queue.getJobs(['waiting'])
    t.is(jobs.length, 1)
    t.is(jobs[0].name, 'notifications.email.send')
    const payload = jobs[0].data.payload as { recipient: { email: string }; button: { link: string } }
    t.is(payload.recipient.email, owner.email)
    t.is(
      new URL(payload.button.link, ENV.VITE_BACKEND_URL).pathname,
      `${new URL(ENV.VITE_BACKEND_URL).pathname.replace(/\/$/, '')}/auth/magiclogin/callback`
    )
  } finally {
    await User.collection.updateOne(
      { _id: owner._id },
      originalIdentity === undefined ? { $unset: { 'fk.magiclogin': '' } } : { $set: { 'fk.magiclogin': originalIdentity } }
    )
    await admin
      .send('post', '/admin/displaySettings')
      .set('Origin', origin)
      .set('X-CSRF-Token', admin.token)
      .send({ _id: settings._id, auth: settings.auth })
      .expect(200)
  }
})

test.after.always(async () => {
  try {
    for (const client of sessions) {
      await client.send('delete', '/auth/logout').set('Origin', origin).set('X-CSRF-Token', client.token)
    }
    await ExpenseReport.collection.deleteOne({ _id: reportId })
  } finally {
    await shutdown()
  }
})
