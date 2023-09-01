import test from 'ava'
import agent from './_agent.js'
import { Country } from '../../../common/types.js'

test('GET /country', async (t) => {
  const res = await agent.get('/api/country')
  t.is(res.status, 200)
})

test('GET /country?addLumpSums=true', async (t) => {
  t.plan(2)
  const res = await agent.get('/api/country').query({ addLumpSums: 'true' })
  t.is(res.status, 200)
  t.true((res.body.data[0] as Country).hasOwnProperty('lumpSums'))
})
