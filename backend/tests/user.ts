import request from 'supertest'
import app from '../app.js'
import { ExecutionContext } from 'ava'
import { User } from '../../common/types.js'

const agent = request.agent(app)

export async function testLogin(t: ExecutionContext) {
  const res = await agent.post('/login').send({ username: 'professor', password: 'professor' })
  t.is(res.status, 200)
}

await agent.post('/login').send({ username: 'professor', password: 'professor' })

export async function testGetUser(t: ExecutionContext) {
  const res = await agent.get('/api/user')
  t.is(res.status, 200)
}

export async function testGetUserToken(t: ExecutionContext) {
  const res = await agent.get('/api/user/token')
  t.is(res.status, 200)
}

export async function testPostUserToken(t: ExecutionContext) {
  t.plan(3)
  const res = await agent.post('/api/user/token')
  t.is(res.status, 200)
  t.true(res.body.result.hasOwnProperty('_id'))
  t.deepEqual(res.body.result.files, [])
}

export async function testDeleteUserToken(t: ExecutionContext) {
  const res = await agent.delete('/api/user/token')
  t.is(res.status, 200)
}

export async function testPostUserSettings(t: ExecutionContext) {
  t.plan(3)
  const settings = { language: 'en', lastCurrencies: [{ _id: 'EUR' }], lastCountries: [{ _id: 'DE' }] }
  const res = await agent.post('/api/user/settings').send(settings)
  t.is(res.status, 200)
  const res2 = await agent.get('/api/user')
  t.is(res2.status, 200, 'GET /user')
  t.like(res2.body.data.settings, settings)
}

export async function testPostUserVehicleRegistration(t: ExecutionContext) {
  t.plan(3)
  const file = { name: 'dummy.pdf', type: 'application/pdf' }
  const res = await agent
    .post('/api/user/vehicleRegistration')
    .field('vehicleRegistration[0][name]', file['name'])
    .field('vehicleRegistration[0][type]', file['type'])
    .attach('vehicleRegistration[0][data]', 'tests/dummy.pdf')
  t.is(res.status, 200)
  t.like(res.body.result.vehicleRegistration, [file])
  const res2 = await agent.get('/api/documentFile').query({ id: (res.body.result as User).vehicleRegistration![0]._id })
  t.is(res2.status, 200, 'GET /documentFile')
}
