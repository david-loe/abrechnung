import request from 'supertest'
import app from '../../app.js'
import { User } from '../../../common/types.js'

const users = {
  user: { username: 'fry', password: 'fry', access: { user: true } },
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
  const res = await agent.get('/api/admin/user').query({ 'fk.ldapauth': users[userKey].username })
  var userId = undefined
  if (res.body.data.length > 0) {
    userId = (res.body.data as User[])[0]._id
  } else {
    await loginUser(agent, userKey)
    await loginUser(agent, 'admin')
  }
  const user = {
    _id: userId,
    fk: { ldapauth: users[userKey].username },
    access: users[userKey].access,
    email: users[userKey].username + '@planetexpress.com'
  }
  await agent.post('/api/admin/user').send(user)
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
  await agent.post('/api/logout')
  await agent.post('/auth/ldapauth').send({ username: users[userKey].username, password: users[userKey].password })
}
