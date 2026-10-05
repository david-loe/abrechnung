import request from 'supertest'
import { createApp, shutdown as shutdownApp } from '../app.js'
import { initializeBackendRuntime } from '../runtime.js'
import { connectTestDatabase } from './_database.js'
import { snapshotSharedFixtures } from './_fixtures.js'
import { users } from './_users.js'

let restoreFixtures: (() => Promise<void>) | undefined

export default async function createAgent() {
  await connectTestDatabase()
  restoreFixtures ??= await snapshotSharedFixtures()
  await initializeBackendRuntime()
  return request.agent(await createApp())
}

export async function loginUser(agent: request.Agent, userKey: keyof typeof users) {
  const logout = await agent.delete('/auth/logout')
  if (logout.status !== 204 && logout.status !== 401) throw new Error(`Logout failed: ${logout.status}`)
  await agent.post('/auth/ldapauth').send({ username: users[userKey].username, password: users[userKey].password }).expect(204)
}

export async function shutdown() {
  try {
    await restoreFixtures?.()
  } finally {
    restoreFixtures = undefined
    await shutdownApp()
  }
}
