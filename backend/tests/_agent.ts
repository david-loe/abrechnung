import { randomUUID } from 'node:crypto'
import { Queue } from 'bullmq'
import request from 'supertest'
import { createApp, shutdown as shutdownApp } from '../app.js'
import ENV from '../env.js'
import { type IntegrationJobData, setIntegrationQueueForTests } from '../integrations/queue.js'
import { initializeBackendRuntime } from '../runtime.js'
import { connectTestDatabase } from './_database.js'
import { blockExchangeRateRequests, restoreExchangeRates } from './_exchangeRates.js'
import { createFixtureTracker, snapshotSharedFixtures } from './_fixtures.js'
import { users } from './_users.js'

let restoreFixtures: (() => Promise<void>) | undefined
let agentQueue: Queue<IntegrationJobData> | undefined
let fixtureTracker: Awaited<ReturnType<typeof createFixtureTracker>> | undefined

export default async function createAgent() {
  blockExchangeRateRequests()
  await connectTestDatabase()
  restoreFixtures ??= await snapshotSharedFixtures()
  await initializeBackendRuntime()
  fixtureTracker ??= await createFixtureTracker()
  if (!agentQueue) {
    agentQueue = new Queue<IntegrationJobData>(`test-agent-${randomUUID()}`, { connection: { url: ENV.REDIS_URL } })
    setIntegrationQueueForTests(agentQueue)
  }
  const agent = request.agent(await createApp()).set('Origin', new URL(ENV.VITE_FRONTEND_URL).origin)
  const post = agent.post.bind(agent)
  agent.post = (path: string) => {
    const mutation = post(path)
    mutation.on('response', (response) => {
      if (response.status < 400) fixtureTracker?.recordResponse(path, response.body?.result)
    })
    return mutation
  }
  return agent
}

export async function loginUser(agent: request.Agent, userKey: keyof typeof users) {
  const logout = await agent.delete('/auth/logout')
  if (logout.status !== 204 && logout.status !== 401) throw new Error(`Logout failed: ${logout.status}`)
  await agent.post('/auth/ldapauth').send({ username: users[userKey].username, password: users[userKey].password }).expect(204)
  await refreshCsrfToken(agent)
}

export async function refreshCsrfToken(agent: request.Agent) {
  const response = await agent.get('/auth/csrf').expect(200)
  agent.set('X-CSRF-Token', response.body.csrfToken)
}

export async function shutdown() {
  try {
    await fixtureTracker?.cleanup()
  } finally {
    try {
      await restoreExchangeRates()
    } finally {
      try {
        await restoreFixtures?.()
      } finally {
        restoreFixtures = undefined
        fixtureTracker = undefined
        try {
          await agentQueue?.obliterate({ force: true })
        } finally {
          await agentQueue?.close()
          agentQueue = undefined
          await shutdownApp()
        }
      }
    }
  }
}
