import { AuthContext, User } from 'abrechnung-common/types.js'
import test from 'ava'
import { shutdown } from '../../app.js'
import { objectToFormFields } from '../../helper.js'
import DocumentFile from '../../models/documentFile.js'
import createAgent, { loginUser } from '../_agent.js'

const agent = await createAgent()
await loginUser(agent, 'user')
let initialCacheScope = ''

test.serial('POST /auth/ldapauth', async (t) => {
  const res = await agent.post('/auth/ldapauth').send({ username: 'professor', password: 'professor' })
  if (res.status === 204) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /user', async (t) => {
  const res = await agent.get('/user')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('GET /auth/authenticated returns the offline cache context', async (t) => {
  const res = await agent.get('/auth/authenticated')
  t.is(res.status, 200)
  const context = res.body as AuthContext
  t.regex(context.userId, /^[0-9a-f]{24}$/)
  t.truthy(context.permissions.user)
  t.true(Date.parse(context.expiresAt) > Date.now())
  t.truthy(context.cacheScope)
  initialCacheScope = context.cacheScope
})

test.serial('GET /user/token', async (t) => {
  const res = await agent.get('/user/token')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('POST /user/token', async (t) => {
  t.plan(3)
  const res = await agent.post('/user/token')
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  t.true('_id' in res.body.result)
  t.deepEqual(res.body.result.files, [])
})

test.serial('DELETE /user/token', async (t) => {
  const res = await agent.delete('/user/token')
  if (res.status === 204) {
    t.pass()
  } else {
    console.log(res.body)
  }
})

test.serial('POST /user/settings', async (t) => {
  t.plan(3)
  const settings = { language: 'en', lastCurrencies: [{ _id: 'EUR' }], lastCountries: [{ _id: 'DE' }] }
  const res = await agent.post('/user/settings').send(settings)
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  const res2 = await agent.get('/user')
  t.is(res2.status, 200, 'GET /user')
  t.like(res2.body.data.settings, settings)
})

test.serial('POST /user/settings normalizes and validates the current user bank account', async (t) => {
  const res = await agent
    .post('/user/settings')
    .send({ bankAccount: { accountHolder: 'Philip J. Fry', iban: 'de89 3704 0044 0532 0130 00', bic: 'cobadeff' } })
  t.is(res.status, 200)
  t.is(res.body.result.bankAccount.iban, 'DE89370400440532013000')
  t.is(res.body.result.bankAccount.bic, 'COBADEFF')
  t.is(
    (await agent.post('/user/settings').send({ bankAccount: { accountHolder: 'Philip J. Fry', iban: 'DE89370400440532013001' } })).status,
    422
  )
  const removeResponse = await agent.post('/user/settings').send({ bankAccount: null })
  t.is(removeResponse.status, 200)
  t.is(removeResponse.body.result.bankAccount, null)
})

const vehicleRegistration = { vehicleRegistration: [{ name: 'dummy.pdf', type: 'application/pdf', data: 'tests/files/dummy.pdf' }] }

test.serial('POST /user/vehicleRegistration', async (t) => {
  t.plan(2)
  let req = agent.post('/user/vehicleRegistration')
  for (const entry of objectToFormFields(vehicleRegistration)) {
    if (entry.field.length > 6 && entry.field.slice(-6) === '[data]') {
      req = req.attach(entry.field, entry.val)
    } else {
      req = req.field(entry.field, entry.val)
    }
  }
  const res = await req
  if (res.status === 200) {
    t.pass()
  } else {
    console.log(res.body)
  }
  const res2 = await agent.get('/documentFile').query({ _id: (res.body.result as User).vehicleRegistration?.[0]._id })
  t.is(res2.status, 200, 'GET /documentFile')
})

test.serial('POST /user/vehicleRegistration claims a temporary upload', async (t) => {
  const upload = await agent
    .post('/documentFile')
    .attach('file', 'tests/files/dummy.pdf', { filename: 'phone-upload.pdf', contentType: 'application/pdf' })
  t.is(upload.status, 201)
  const documentFileId = upload.body.result._id as string
  t.truthy((await DocumentFile.findById(documentFileId).select('+expiresAt').lean())?.expiresAt)

  const response = await agent
    .post('/user/vehicleRegistration')
    .field('vehicleRegistration[0][_id]', documentFileId)
    .field('vehicleRegistration[0][name]', 'phone-upload.pdf')
    .field('vehicleRegistration[0][type]', 'application/pdf')
  t.is(response.status, 200)

  const storedDocument = await DocumentFile.findById(documentFileId).select('+expiresAt').lean()
  t.is(storedDocument?.expiresAt, undefined)
})

test.serial('POST /user/vehicleRegistration allows clearing all files', async (t) => {
  t.plan(2)
  const res = await agent.post('/user/vehicleRegistration').field('noop', '1')
  t.is(res.status, 200)

  const res2 = await agent.get('/user')
  t.is((res2.body.data as User).vehicleRegistration?.length ?? 0, 0)
})

test.serial('DELETE /auth/logout destroys the session and rotates the cache scope after login', async (t) => {
  const logoutResponse = await agent.delete('/auth/logout')
  t.is(logoutResponse.status, 204)
  t.is((await agent.get('/auth/authenticated')).status, 401)

  const loginResponse = await agent.post('/auth/ldapauth').send({ username: 'fry', password: 'fry' })
  t.is(loginResponse.status, 204)
  const newContext = (await agent.get('/auth/authenticated')).body as AuthContext
  t.not(newContext.cacheScope, initialCacheScope)
})

test.serial.after.always('Drop DB Connection', async () => {
  await shutdown()
})
