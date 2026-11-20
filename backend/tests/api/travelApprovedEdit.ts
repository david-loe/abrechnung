import { Travel, TravelState, User } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import createAgent, { loginUser, shutdown } from '../_agent.js'

// A travel approved by someone else (supervisor or API client) stays editable for its owner
// as long as the owner is allowed to create approved travels directly.

const agent = await createAgent()

let owner: User<string>
let travel: Travel<string>

async function setOwnerAccess(access: User['access']) {
  await loginUser(agent, 'admin')
  await agent.post('/admin/user').send({ _id: owner._id, access }).expect(200)
}

test.serial('supervisor creates an approved travel for the owner', async (t) => {
  await loginUser(agent, 'user')
  owner = (await agent.get('/user').expect(200)).body.data
  const project = (await agent.get('/project').expect(200)).body.data[0]

  await loginUser(agent, 'travel')
  const response = await agent
    .post('/approve/travel/approved')
    .send({
      name: `Approved by supervisor ${new Types.ObjectId()}`,
      reason: 'Conference',
      destinationPlace: { country: 'DE', place: 'Hamburg' },
      startDate: '2026-06-10',
      endDate: '2026-06-12',
      project: project._id,
      owner: owner._id
    })
    .expect(200)
  travel = response.body.result
  t.is(travel.state, TravelState.APPROVED)
  t.is(travel.owner._id, owner._id)
  t.not(travel.editor._id, owner._id)
})

test.serial('owner without approved:travel cannot edit a travel approved by someone else', async (t) => {
  await loginUser(agent, 'user')
  const response = await agent.post('/travel/approved').send({ _id: travel._id, name: 'Renamed by owner' })
  t.is(response.status, 403, JSON.stringify(response.body))
  t.is((await agent.get('/travel').query({ _id: travel._id }).expect(200)).body.data.name, travel.name)
})

test.serial('owner with approved:travel can edit name and dates of a travel approved by someone else', async (t) => {
  await setOwnerAccess({ ...owner.access, 'approved:travel': true })
  try {
    await loginUser(agent, 'user')
    const response = await agent
      .post('/travel/approved')
      .send({ _id: travel._id, name: 'Renamed by owner', startDate: '2026-06-11', endDate: '2026-06-13' })
      .expect(200)
    const updated = response.body.result as Travel<string>
    t.is(updated.name, 'Renamed by owner')
    t.is(new Date(updated.startDate).toISOString(), '2026-06-11T00:00:00.000Z')
    t.is(new Date(updated.endDate).toISOString(), '2026-06-13T00:00:00.000Z')
    t.is(updated.state, TravelState.APPROVED)
    t.is(updated.editor._id, owner._id)
  } finally {
    await setOwnerAccess(owner.access)
  }
})

test.after.always(async () => {
  await shutdown()
})
