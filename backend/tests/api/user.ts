import { User } from 'abrechnung-common/types.js'
import test from 'ava'
import { disconnectDB } from '../../db.js'
import createAgent, { loginUser } from './_agent.js'
import { objectToFormFields } from './_helper.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('POST /auth/ldapauth', async (t) => {
  const res = await agent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })
  if (res.status === 204) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test('GET /user', async (t) => {
  const res = await agent.get('/user')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test('GET /user/token', async (t) => {
  const res = await agent.get('/user/token')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test('POST /user/token', async (t) => {
  t.plan(3)
  const res = await agent.post('/user/token')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.true('_id' in res.body.result)
  t.deepEqual(res.body.result.files, [])
})

test('DELETE /user/token', async (t) => {
  const res = await agent.delete('/user/token')
  if (res.status === 204) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test('POST /user/settings', async (t) => {
  t.plan(3)
  const settings = { language: 'en', lastCurrencies: [{ _id: 'EUR' }], lastCountries: [{ _id: 'DE' }] }
  const res = await agent.post('/user/settings').send(settings)
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  const res2 = await agent.get('/user')
  t.is(res2.status, 200, 'GET /user')
  t.like(res2.body.data.settings, settings)
})

const vehicleRegistration = { vehicleRegistration: [{ name: 'dummy.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }] }

test('POST /user/vehicleRegistration', async (t) => {
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
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  const res2 = await agent.get('/documentFile').query({ _id: (res.body.result as User).vehicleRegistration?.[0]._id })
  t.is(res2.status, 200, 'GET /documentFile')
})

test.serial.after.always('Drop DB Connection', async () => {
  await disconnectDB()
})
