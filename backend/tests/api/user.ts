import test from 'ava'
import agent from './_agent.js'
import { User } from '../../../common/types.js'

test('POST /login', async (t) => {
  const res = await agent.post('/login').send({ username: 'professor', password: 'professor' })
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

test('POST /user/vehicleRegistration', async (t) => {
  t.plan(3)
  const file = { name: 'dummy.pdf', type: 'application/pdf' }
  const res = await agent
    .post('/api/user/vehicleRegistration')
    .field('vehicleRegistration[0][name]', file['name'])
    .field('vehicleRegistration[0][type]', file['type'])
    .attach('vehicleRegistration[0][data]', 'tests/api/dummy.pdf')
  t.is(res.status, 200)
  t.like(res.body.result.vehicleRegistration, [file])
  const res2 = await agent.get('/api/documentFile').query({ id: (res.body.result as User).vehicleRegistration![0]._id })
  t.is(res2.status, 200, 'GET /documentFile')
})
