import test from 'ava'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApp, shutdown } from '../../app.js'
import { sessionStore } from '../../db.js'
import { initializeBackendRuntime } from '../../runtime.js'
import { connectTestDatabase } from '../_database.js'

await connectTestDatabase()
await initializeBackendRuntime()
const app = await createApp()
const store = await sessionStore()
const sessions = mongoose.connection.collection<{ _id: string; session: string; lastModified?: Date; expires: Date }>('sessions')
const ids = new Set<string>()
let sets = 0
let touches = 0
store.on('set', () => sets++)
store.on('touch', () => touches++)
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

let slowStarted = deferred()
let releaseSlow = deferred()

app.post('/__test/session', (req, res) => {
  req.session.redirect = req.body.redirect
  ids.add(req.sessionID)
  res.json({ id: req.sessionID })
})
app.get('/__test/session', (req, res) => {
  ids.add(req.sessionID)
  res.json({ id: req.sessionID, redirect: req.session.redirect, expires: req.session.cookie.expires })
})
app.get('/__test/slow-session', async (req, res) => {
  slowStarted.resolve()
  await releaseSlow.promise
  res.json({ redirect: req.session.redirect })
})

async function client() {
  const agent = request.agent(app)
  const response = await agent.post('/__test/session').send({ redirect: '/initial' }).expect(200)
  return { agent, id: response.body.id as string }
}

test.serial('unchanged reads skip session writes within the touch interval', async (t) => {
  const { agent, id } = await client()
  const before = await sessions.findOne({ _id: id })
  const initialSets = sets
  const initialTouches = touches
  for (let i = 0; i < 3; i++) {
    const response = await agent.get('/__test/session').expect(200)
    t.is(response.body.redirect, '/initial')
    t.false('set-cookie' in response.headers)
  }
  t.is(sets, initialSets)
  t.is(touches, initialTouches)
  t.deepEqual(await sessions.findOne({ _id: id }), before)
})

test.serial('reads refresh aged sessions and real session changes save immediately', async (t) => {
  const { agent, id } = await client()
  const old = new Date(Date.now() - 301_000)
  await sessions.updateOne({ _id: id }, { $set: { lastModified: old } })
  const initialSets = sets
  const initialTouches = touches
  await agent.get('/__test/session').expect(200)
  t.is(sets, initialSets)
  t.is(touches, initialTouches + 1)
  const touched = await sessions.findOne({ _id: id })
  t.true(Boolean(touched?.lastModified && touched.lastModified > old))
  await agent.post('/__test/session').send({ redirect: '/changed' }).expect(200)
  t.is(sets, initialSets + 1)
  t.is(JSON.parse((await sessions.findOne({ _id: id }))?.session ?? '{}').redirect, '/changed')
})

test.serial('an older parallel read cannot overwrite a newer session change', async (t) => {
  const { agent, id } = await client()
  slowStarted = deferred()
  releaseSlow = deferred()
  const slow = agent.get('/__test/slow-session').then((response) => response)
  await slowStarted.promise
  try {
    await agent.post('/__test/session').send({ redirect: '/newer' }).expect(200)
  } finally {
    releaseSlow.resolve()
    await slow
  }
  t.is(JSON.parse((await sessions.findOne({ _id: id }))?.session ?? '{}').redirect, '/newer')
  t.is((await agent.get('/__test/session')).body.redirect, '/newer')
})

test.serial('existing sessions without touch metadata remain usable', async (t) => {
  const { agent, id } = await client()
  await sessions.updateOne({ _id: id }, { $unset: { lastModified: '' } })
  t.is((await agent.get('/__test/session')).body.redirect, '/initial')
  await agent.post('/__test/session').send({ redirect: '/saved' }).expect(200)
  t.true((await sessions.findOne({ _id: id }))?.lastModified instanceof Date)
})

test.serial('expired sessions cannot retain authentication and logout destroys live sessions', async (t) => {
  const agent = request.agent(app)
  await agent.post('/auth/ldapauth').send({ username: 'fry', password: 'fry' }).expect(204)
  const response = await agent.get('/__test/session').expect(200)
  const id = response.body.id as string
  const context = (await agent.get('/auth/authenticated').expect(200)).body
  t.true(Date.parse(context.expiresAt) > Date.now())
  t.true(Date.parse(context.expiresAt) <= Date.parse(response.body.expires))
  await sessions.updateOne({ _id: id }, { $set: { expires: new Date(Date.now() - 1_000) } })
  t.is((await agent.get('/auth/authenticated')).status, 401)

  await agent.post('/auth/ldapauth').send({ username: 'fry', password: 'fry' }).expect(204)
  const fresh = await agent.get('/__test/session').expect(200)
  await agent.delete('/auth/logout').expect(204)
  t.is(await sessions.findOne({ _id: fresh.body.id }), null)
  t.is((await agent.get('/auth/authenticated')).status, 401)
})

test.after.always(async () => {
  releaseSlow.resolve()
  await sessions.deleteMany({ _id: { $in: [...ids] } })
  await shutdown()
})
