import test from 'ava'
import { User } from '../../../common/types.js'
import createAgent, { loginUser } from './_agent.js'
import { objectToFormFields } from './_helper.js'

const agent = createAgent()
await loginUser(agent)

test('POST /auth/ldapauth', async (t) => {
  const res = await agent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })
  t.is(res.status, 200)
})

test('GET /user', async (t) => {
  const res = await agent.get('/api/user')
  t.is(res.status, 200)
})

test('GET /user/token', async (t) => {
  const res = await agent.get('/api/user/token')
  t.is(res.status, 200)
})

test('POST /user/token', async (t) => {
  t.plan(3)
  const res = await agent.post('/api/user/token')
  t.is(res.status, 200)
  t.true(res.body.result.hasOwnProperty('_id'))
  t.deepEqual(res.body.result.files, [])
})

test('DELETE /user/token', async (t) => {
  const res = await agent.delete('/api/user/token')
  t.is(res.status, 200)
})

test('POST /user/settings', async (t) => {
  t.plan(3)
  const settings = { language: 'en', lastCurrencies: [{ _id: 'EUR' }], lastCountries: [{ _id: 'DE' }] }
  const res = await agent.post('/api/user/settings').send(settings)
  t.is(res.status, 200)
  const res2 = await agent.get('/api/user')
  t.is(res2.status, 200, 'GET /user')
  t.like(res2.body.data.settings, settings)
})

const vehicleRegistration = {
  vehicleRegistration: [{ name: 'dummy.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }]
}

test('POST /user/vehicleRegistration', async (t) => {
  t.plan(2)
  var req = agent.post('/api/user/vehicleRegistration')
  for (const entry of objectToFormFields(vehicleRegistration)) {
    if (entry.field.length > 6 && entry.field.slice(-6) == '[data]') {
      req = req.attach(entry.field, entry.val)
    } else {
      req = req.field(entry.field, entry.val)
    }
  }
  const res = await req
  t.is(res.status, 200)
  const res2 = await agent.get('/api/documentFile').query({ id: (res.body.result as User).vehicleRegistration![0]._id })
  t.is(res2.status, 200, 'GET /documentFile')
})
