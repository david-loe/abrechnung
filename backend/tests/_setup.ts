import request from 'supertest'
import APP, { shutdown } from '../app.js'
import User from '../models/user.js'
import { users } from './_users.js'

const started = performance.now()
try {
  const agent = request.agent(await APP())
  // Bootstrap each LDAP identity only once; advance and health care share bender.
  const fixtures = new Map([users.admin, ...Object.values(users)].map((user) => [user.username, user]))
  for (const user of fixtures.values()) {
    await agent.post('/auth/ldapauth').send({ username: user.username, password: user.password }).expect(204)
    await User.updateOne({ 'fk.ldapauth': user.username }, { $set: { access: user.access } })
  }
  await agent.delete('/auth/logout').expect(204)
  console.log(`Backend test setup: ${fixtures.size} LDAP users, ${Math.round(performance.now() - started)} ms`)
} finally {
  await shutdown()
}
