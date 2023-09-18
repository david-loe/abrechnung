import request from 'supertest'
import app from '../../app.js'
import { User } from '../../../common/types.js'

export default function createAgent() {
  return request.agent(app)
}

export async function loginUser(agent: request.SuperAgentTest) {
  await agent.post('/api/logout')
  await agent.post('/login').send({ username: 'fry', password: 'fry' })
}

export async function loginAdmin(agent: request.SuperAgentTest) {
  await agent.post('/api/logout')
  await agent.post('/login').send({ username: 'professor', password: 'professor' })
}

export async function loginExamineTravel(agent: request.SuperAgentTest) {
  await loginAdmin(agent)
  const res = await agent.get('/api/admin/user').query({ uid: 'zoidberg' })
  var userId = undefined
  if (res.body.data.length > 0) {
    userId = (res.body.data as User[])[0]._id
  }
  const user = { _id: userId, uid: 'zoidberg', access: { 'examine/travel': true } }
  await agent.post('/api/admin/user').send(user)
  await agent.post('/api/logout')
  await agent.post('/login').send({ username: 'zoidberg', password: 'zoidberg' })
}

export async function loginExamineExpenseReport(agent: request.SuperAgentTest) {
  await loginAdmin(agent)
  const res = await agent.get('/api/admin/user').query({ uid: 'leela' })
  var userId = undefined
  if (res.body.data.length > 0) {
    userId = (res.body.data as User[])[0]._id
  }
  const user = { _id: userId, uid: 'leela', access: { 'examine/expenseReport': true } }
  await agent.post('/api/admin/user').send(user)
  await agent.post('/api/logout')
  await agent.post('/login').send({ username: 'leela', password: 'leela' })
}

export async function loginApprove(agent: request.SuperAgentTest) {
  await loginAdmin(agent)
  const res = await agent.get('/api/admin/user').query({ uid: 'hermes' })
  var userId = undefined
  if (res.body.data.length > 0) {
    userId = (res.body.data as User[])[0]._id
  }
  const user = { _id: userId, uid: 'hermes', access: { approve: true } }
  await agent.post('/api/admin/user').send(user)
  await agent.post('/api/logout')
  await agent.post('/login').send({ username: 'hermes', password: 'hermes' })
}
