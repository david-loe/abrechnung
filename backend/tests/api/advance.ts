import { Advance, AdvanceSimple, AdvanceState } from 'abrechnung-common/types.js'
import test from 'ava'
import { disconnectDB } from '../../db.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')

let advance: Partial<Advance> = {
  name: 'Advance for next trip',
  reason: 'Traveling is expensive', // biome-ignore lint/suspicious/noExplicitAny: using Types.ObjectId to set IdDocument in backend
  budget: { amount: 1000, currency: 'USD' as any }
}

test.serial('GET /project', async (t) => {
  const res = await agent.get('/project')
  advance.project = res.body.data[0]
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('POST /advance/appliedFor', async (t) => {
  const res = await agent.post('/advance/appliedFor').send(advance)
  advance = res.body.result
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /advance', async (t) => {
  t.plan(2)
  const res = await agent.get('/advance')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  for (const gotAdvance of res.body.data as AdvanceSimple[]) {
    if (advance._id === gotAdvance._id) {
      t.pass()
      break
    }
  }
})

// APPROVE

test.serial('POST /approve/advance/approved', async (t) => {
  await loginUser(agent, 'advance')
  t.plan(3)
  const bookingRemark = 'My Booking Remark'
  const res = await agent.post('/approve/advance/approved').send({ _id: advance._id, bookingRemark })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is((res.body.result as Advance).state, AdvanceState.APPROVED)
  t.is((res.body.result as Advance).bookingRemark, bookingRemark)
})

// REPORT

test.serial('GET /advance/report', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.get('/advance/report').query({ _id: advance._id })
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

// BOOK

test.serial('POST /book/advance/booked', async (t) => {
  await loginUser(agent, 'advance')
  t.plan(2)
  const res = await agent.post('/book/advance/booked').send([advance._id])
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.is(res.body.result[0].status, 'fulfilled')
})

test.serial('DELETE /advance 40X', async (t) => {
  await loginUser(agent, 'user')
  const res = await agent.delete('/advance').query({ _id: advance._id })
  t.not(res.status, 200)
})

test.serial.after.always('Drop DB Connection', async () => {
  await disconnectDB()
})
