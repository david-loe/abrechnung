import { Country } from 'abrechnung-common/types.js'
import test from 'ava'
import { disconnectDB } from '../../db.js'
import createAgent, { loginUser } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

test('GET /country', async (t) => {
  const res = await agent.get('/country')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test('GET /country?additionalFields=lumpSums&additionalFields=lumpSumsFrom', async (t) => {
  t.plan(2)
  const res = await agent.get('/country').query({ additionalFields: ['lumpSums', 'lumpSumsFrom'] })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.true('lumpSums' in (res.body.data[0] as Country))
})

test('GET /specialLumpSums', async (t) => {
  const res = await agent.get('/specialLumpSums')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial.after.always('Drop DB Connection', async () => {
  await disconnectDB()
})
