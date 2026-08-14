import { accesses, User as IUser } from 'abrechnung-common/types.js'
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test from 'ava'
import { Types } from 'mongoose'
import { shutdown } from '../../app.js'
import { BACKEND_CACHE } from '../../db.js'
import Project from '../../models/project.js'
import Settings from '../../models/settings.js'
import User from '../../models/user.js'
import createAgent, { loginUser } from '../_agent.js'
import { withSettingsRestore } from '../_settings.js'

const agent = await createAgent()
const uniqueSuffix = new Types.ObjectId().toHexString()
const defaultUserEmail = `creator-defaults-${uniqueSuffix}@example.com`
const bulkUserEmail = `creator-bulk-${uniqueSuffix}@example.com`
const customMagiclogin = `custom-login-${uniqueSuffix}@example.com`
const projectIdentifier = `CREATOR-PROJECT-${uniqueSuffix}`

function assertDefaultAccess(t: import('ava').ExecutionContext, user: IUser | null) {
  for (const access of accesses) {
    t.is(user?.access[access], BACKEND_CACHE.settings.defaultAccess[access])
  }
}

test.serial('creation endpoints reject users without create/usersAndProjects', async (t) => {
  await loginUser(agent, 'travel')
  t.true([401, 403].includes((await agent.get('/create/user')).status))
  t.true([401, 403].includes((await agent.get('/create/project')).status))
})

test.serial('admin can grant create/usersAndProjects', async (t) => {
  await loginUser(agent, 'admin')
  const response = await agent.get('/admin/user').query({ filterJSON: Base64.encode(JSON.stringify({ 'fk.ldapauth': 'fry' })) })
  const creator = (response.body.data as IUser[])[0]
  const update = await agent.post('/admin/user').send({ _id: creator._id, access: { ...creator.access, 'create/usersAndProjects': true } })
  t.is(update.status, 200)
})

test.serial('creator forms expose only allowed fields', async (t) => {
  await loginUser(agent, 'user')
  const userForm = await agent.get('/create/user/form')
  t.is(userForm.status, 200)
  t.truthy(userForm.body.data.employeeId)
  t.truthy(userForm.body.data.loseAccessAt)
  t.falsy(userForm.body.data.access)
  t.deepEqual(Object.keys(userForm.body.data.fk.schema), ['magiclogin'])

  const projectForm = await agent.get('/create/project/form')
  t.is(projectForm.status, 200)
  t.falsy(projectForm.body.data._id)
  t.truthy(projectForm.body.data.assignees)
  t.truthy(projectForm.body.data.supervisors)
})

test.serial('creator user endpoint enforces defaults and sanitizes fields', async (t) => {
  const projectsResponse = await agent.get('/project')
  const organisationsResponse = await agent.get('/organisation')
  const projectId = projectsResponse.body.data[0]._id as string
  const organisationId = organisationsResponse.body.data[0]._id as string
  const loseAccessAt = '2030-01-02T00:00:00.000Z'
  const email = defaultUserEmail

  const response = await agent
    .post('/create/user')
    .send({
      _id: '000000000000000000000001',
      name: { givenName: 'Created', familyName: 'Defaults' },
      email,
      employeeId: `CREATOR-${uniqueSuffix}`,
      fk: { magiclogin: '', ldapauth: 'forbidden', microsoft: 'forbidden', httpBearer: 'forbidden' },
      access: { admin: true, user: false },
      loseAccessAt,
      projects: { assigned: [projectId] },
      settings: { language: 'en', organisation: organisationId, showInstallBanner: false }
    })

  t.is(response.status, 200)
  t.is(response.body.result.fk.magiclogin, email)
  t.falsy(response.body.result.access)
  t.deepEqual(Object.keys(response.body.result.fk), ['magiclogin'])

  const stored = await User.findOne({ email }).lean()
  t.truthy(stored)
  assertDefaultAccess(t, stored)
  t.is(stored?.fk.magiclogin, email)
  t.falsy(stored?.fk.ldapauth)
  t.falsy(stored?.fk.microsoft)
  t.falsy(stored?.fk.httpBearer)
  t.is(stored?.settings.showInstallBanner, true)
  t.is(stored?.loseAccessAt && new Date(stored.loseAccessAt).toISOString(), loseAccessAt)
  t.not(stored?._id.toString(), '000000000000000000000001')

  const list = await agent.get('/create/user').query({ filterJSON: Base64.encode(JSON.stringify({ email })) })
  t.is(list.status, 200)
  t.is(list.body.data.length, 1)
  t.falsy(list.body.data[0].access)
  t.deepEqual(Object.keys(list.body.data[0].fk), ['magiclogin'])
  t.falsy(list.body.data[0].settings.showInstallBanner)
})

test.serial('creator bulk endpoint preserves custom magic login', async (t) => {
  const response = await agent
    .post('/create/user/bulk')
    .send([
      {
        name: { givenName: 'Bulk', familyName: 'Custom Login' },
        email: bulkUserEmail,
        fk: { magiclogin: customMagiclogin, oidc: 'forbidden' },
        access: { admin: true }
      }
    ])

  t.is(response.status, 200)
  const stored = await User.findOne({ email: bulkUserEmail }).lean()
  t.is(stored?.fk.magiclogin, customMagiclogin)
  t.falsy(stored?.fk.oidc)
  assertDefaultAccess(t, stored)
})

test.serial('creator can create and list projects but cannot update or delete them', async (t) => {
  const organisationsResponse = await agent.get('/organisation')
  const organisation = organisationsResponse.body.data[0]
  const requestedId = '000000000000000000000002'
  const response = await agent
    .post('/create/project')
    .send({
      _id: requestedId,
      identifier: projectIdentifier,
      name: 'Creator Project',
      organisation: organisation._id,
      budget: { amount: 1200 },
      balance: { amount: 0 }
    })

  t.is(response.status, 200)
  t.not(response.body.result._id, requestedId)
  const stored = await Project.findOne({ identifier: projectIdentifier }).lean()
  t.is(stored?.budget?.amount, 1200)

  const list = await agent.get('/create/project').query({ filterJSON: Base64.encode(JSON.stringify({ identifier: projectIdentifier })) })
  t.is(list.status, 200)
  t.is(list.body.data.length, 1)

  t.is((await agent.delete('/create/project').query({ _id: stored?._id.toString() })).status, 404)
  const attemptedUpdate = await agent
    .post('/create/project')
    .send({ _id: stored?._id.toString(), identifier: `${projectIdentifier}-NEW`, name: 'Changed', organisation: organisation._id })
  t.is(attemptedUpdate.status, 200)
  t.not(attemptedUpdate.body.result._id, stored?._id.toString())
  t.is((await Project.findById(stored?._id).lean())?.name, 'Creator Project')
})

test.serial('creator can list standard projects when project visibility is restricted', async (t) => {
  await withSettingsRestore(Settings, {}, async () => {
    const settings = await Settings.findOne()
    const creator = await User.findOne({ 'fk.ldapauth': 'fry' })
    t.truthy(settings)
    t.truthy(creator)
    if (!settings || !creator) return

    const originalCreateAccess = creator.access['create/usersAndProjects']

    try {
      settings.userCanSeeAllProjects = false
      await settings.save()

      await loginUser(agent, 'user')
      const creatorList = await agent
        .get('/project')
        .query({ filterJSON: Base64.encode(JSON.stringify({ identifier: projectIdentifier })) })
      t.is(creatorList.status, 200)
      t.is(creatorList.body.data.length, 1)

      creator.access['create/usersAndProjects'] = false
      await creator.save()

      const unauthorizedList = await agent.get('/project')
      t.is(unauthorizedList.status, 401)
      t.is(unauthorizedList.body.name, 'alerts.unauthorized')
    } finally {
      creator.access['create/usersAndProjects'] = originalCreateAccess
      await creator.save()
    }
  })
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
