import request from 'supertest'
import app from '../app.js'
import { ExecutionContext } from 'ava'

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
  const res = await agent.post('/api/user/token')
  t.is(res.status, 200)
}

export async function testDeleteUserToken(t: ExecutionContext) {
  const res = await agent.delete('/api/user/token')
  t.is(res.status, 200)
}
