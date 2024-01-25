import test from 'ava'
import { Country } from '../../../common/types.js'
import createAgent, { loginUser } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('GET /country', async (t) => {
  const res = await agent.get('/api/country')
  if (res.status === 200) { t.pass() } else { console.log(res.body) }
})

test('GET /country?addLumpSums=true', async (t) => {
  t.plan(2)
  const res = await agent.get('/api/country').query({ addLumpSums: 'true' })
  if (res.status === 200) { t.pass() } else { console.log(res.body) }
  t.true((res.body.data[0] as Country).hasOwnProperty('lumpSums'))
})

test('GET /specialLumpSums', async (t) => {
  const res = await agent.get('/api/specialLumpSums')
  if (res.status === 200) { t.pass() } else { console.log(res.body) }
})