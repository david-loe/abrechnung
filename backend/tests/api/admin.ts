import { Organisation as IOrganisation, User } from 'abrechnung-common/types.js'
import test from 'ava'
import { Types } from 'mongoose'
import { shutdown } from '../../app.js'
import DocumentFile from '../../models/documentFile.js'
import Organisation from '../../models/organisation.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')

test('POST /admin/user', async (t) => {
  t.plan(4)
  const res = await agent.get('/user')
  t.is(res.status, 200, 'GET /user')
  const userId = (res.body.data as User)._id
  t.true((res.body.data as User).access.admin)

  const user = { _id: userId, name: { givenName: 'Admin', familyName: 'User' } }
  const res2 = await agent.post('/admin/user').send(user)
  t.is(res2.status, 200)
  t.like(res2.body.result, user)
})

test.serial('POST /admin/organisation claims its temporary logo only after a successful save', async (t) => {
  const upload = await agent
    .post('/documentFile')
    .attach('file', 'tests/files/dummy.pdf', { filename: 'phone-logo.pdf', contentType: 'application/pdf' })
  t.is(upload.status, 201)
  const documentFileId = upload.body.result._id as string

  const organisations = await agent.get('/admin/organisation')
  t.is(organisations.status, 200)
  const organisation = (organisations.body.data as IOrganisation<string>[])[0]
  const original = await Organisation.collection.findOne({ _id: new Types.ObjectId(organisation._id) }, { projection: { logo: 1 } })

  async function postOrganisation(name: string) {
    return await agent
      .post('/admin/organisation')
      .field('_id', organisation._id)
      .field('name', name)
      .field('logo[_id]', documentFileId)
      .field('logo[name]', 'phone-logo.pdf')
      .field('logo[type]', 'application/pdf')
  }

  try {
    const invalidResponse = await postOrganisation('')
    t.is(invalidResponse.status, 422)
    t.truthy((await DocumentFile.findById(documentFileId).select('+expiresAt').lean())?.expiresAt)

    const response = await postOrganisation(organisation.name)
    t.is(response.status, 200)
    const storedDocument = await DocumentFile.findById(documentFileId).select('+expiresAt').lean()
    t.is(storedDocument?.expiresAt, undefined)
  } finally {
    const logoUpdate = original?.logo ? { $set: { logo: original.logo } } : { $unset: { logo: 1 } }
    await Organisation.collection.updateOne({ _id: new Types.ObjectId(organisation._id) }, logoUpdate)
    await DocumentFile.deleteOne({ _id: documentFileId })
  }
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
