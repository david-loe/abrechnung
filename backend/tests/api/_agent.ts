import request from 'supertest'
import { Base64 } from '../../../common/scripts.js'
import { User } from '../../../common/types.js'
import app from '../../app.js'

const users = {
  user: {
    username: 'fry',
    password: 'fry',
    access: { user: true, 'inWork:expenseReport': true, 'inWork:healthCareCost': true, 'appliedFor:travel': true }
  },
  admin: { username: 'professor', password: 'professor', access: { user: true, admin: true } },
  travel: { username: 'zoidberg', password: 'zoidberg', access: { user: true, 'examine/travel': true, 'approve/travel': true } },
  expenseReport: { username: 'leela', password: 'leela', access: { user: true, 'examine/expenseReport': true } },
  healthCareCost: {
    username: 'bender',
    password: 'bender',
    access: { user: true, 'examine/healthCareCost': true, 'confirm/healthCareCost': true }
  }
}

async function createUser(agent: request.SuperAgentTest, userKey: keyof typeof users) {
  await loginUser(agent, userKey)
  await loginUser(agent, 'admin')
  const res = await agent
    .get('/admin/user')
    .query({ filterJSON: Base64.encode(JSON.stringify({ 'fk.ldapauth': users[userKey].username })) })
  if (res.status !== 200) {
    throw new Error('Unable to get user. Probably an access issue.')
  }
  const userId = (res.body.data as User[])[0]._id
  const user = {
    _id: userId,
    access: users[userKey].access
  }
  await agent.post('/admin/user').send(user)
}

export default async function createAgent() {
  const agent = request.agent(app)
  // sign in first with 'professor' to make him admin
  await agent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })
  for (const userKey in users) {
    if (userKey !== 'admin') await createUser(agent, userKey as keyof typeof users)
  }
  return agent
}

export async function loginUser(agent: request.SuperAgentTest, userKey: keyof typeof users) {
  await agent.post('/logout')
  await agent.post('/auth/ldapauth').send({ username: users[userKey].username, password: users[userKey].password })
}
