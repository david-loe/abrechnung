import request from 'supertest'
import app from '../../app.js'
import { User } from '../../../common/types.js'

export default function createAgent() {
  const agent = request.agent(app)
  // sign in first with 'professor' to make him admin
  agent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })
  return agent
}

export async function loginUser(agent: request.SuperAgentTest) {
  await agent.post('/api/logout')
  await agent.post('/auth/ldapauth').send({ username: 'fry', password: 'fry' })
}

export async function loginAdmin(agent: request.SuperAgentTest) {
  await agent.post('/api/logout')
  await agent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })
}

export async function loginTravel(agent: request.SuperAgentTest) {
  await loginAdmin(agent)
  const res = await agent.get('/api/admin/user').query({ 'fk.ldapauth': 'zoidberg' })
  var userId = undefined
  if (res.body.data.length > 0) {
    userId = (res.body.data as User[])[0]._id
  }
  const user = { _id: userId, fk: { ldapauth: 'zoidberg' }, access: { 'examine/travel': true, 'approve/travel': true } }
  await agent.post('/api/admin/user').send(user)
  await agent.post('/api/logout')
  await agent.post('/auth/ldapauth').send({ username: 'zoidberg', password: 'zoidberg' })
}

export async function loginExpenseReport(agent: request.SuperAgentTest) {
  await loginAdmin(agent)
  const res = await agent.get('/api/admin/user').query({ 'fk.ldapauth': 'leela' })
  var userId = undefined
  if (res.body.data.length > 0) {
    userId = (res.body.data as User[])[0]._id
  }
  const user = { _id: userId, fk: { ldapauth: 'leela' }, access: { 'examine/expenseReport': true } }
  await agent.post('/api/admin/user').send(user)
  await agent.post('/api/logout')
  await agent.post('/auth/ldapauth').send({ username: 'leela', password: 'leela' })
}

export async function loginHealthCareCost(agent: request.SuperAgentTest) {
  await loginAdmin(agent)
  const res = await agent.get('/api/admin/user').query({ 'fk.ldapauth': 'bender' })
  var userId = undefined
  if (res.body.data.length > 0) {
    userId = (res.body.data as User[])[0]._id
  }
  const user = { _id: userId, fk: { ldapauth: 'bender' }, access: { 'examine/healthCareCost': true, 'confirm/healthCareCost': true } }
  await agent.post('/api/admin/user').send(user)
  await agent.post('/api/logout')
  await agent.post('/auth/ldapauth').send({ username: 'bender', password: 'bender' })
}
