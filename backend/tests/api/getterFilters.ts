import { TravelState } from 'abrechnung-common/types.js'
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import test from 'ava'
import { Types } from 'mongoose'
import Organisation from '../../models/organisation.js'
import Project from '../../models/project.js'
import Travel from '../../models/travel.js'
import User from '../../models/user.js'
import createAgent, { loginUser, shutdown } from '../_agent.js'

const agent = await createAgent()
const admin = await createAgent()
const userIds = [new Types.ObjectId(), new Types.ObjectId()]
const organisationId = new Types.ObjectId()
const projectIds = [new Types.ObjectId(), new Types.ObjectId()]
const travelIds = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()]
const iban = 'DE89370400440532013000'

function query(filter: unknown) {
  return { filterJSON: Base64.encode(JSON.stringify(filter)) }
}

test.before(async () => {
  await loginUser(agent, 'travel')
  await loginUser(admin, 'admin')
  const owner = (await agent.get('/user').expect(200)).body.data
  const otherOwner = (await admin.get('/user').expect(200)).body.data
  const organisation = await Organisation.collection.findOne()
  if (!organisation) throw new Error('Missing organisation fixture')

  await User.collection.insertMany(
    userIds.map((_id, index) => ({
      _id,
      name: { givenName: 'Projection', familyName: index === 0 ? 'Visible' : 'Other' },
      email: `projection-${_id}@example.invalid`,
      fk: {},
      projects: { assigned: [], supervised: [] },
      settings: { bankAccount: { accountHolder: 'Projection', iban } }
    }))
  )
  await Organisation.collection.insertOne({
    ...organisation,
    _id: organisationId,
    name: `Projection ${organisationId}`,
    accountingSettings: { ...organisation.accountingSettings, vatRates: [{ rate: 0 }, { rate: 7, inputTaxAccount: new Types.ObjectId() }] }
  })
  await Project.collection.insertMany(
    projectIds.map((_id, index) => ({
      _id,
      identifier: `PROJECTION-${_id}`,
      name: index === 0 ? 'Visible project' : 'Other project',
      organisation: organisationId,
      budget: { amount: 100, currency: 'EUR' },
      balance: { amount: 75, currency: 'EUR' }
    }))
  )
  await Travel.collection.insertMany(
    travelIds.map((_id, index) => ({
      _id,
      name: `Projection travel ${organisationId}`,
      owner: new Types.ObjectId(index === 1 ? otherOwner._id : owner._id),
      editor: new Types.ObjectId(owner._id),
      project: projectIds[0],
      state: TravelState.APPLIED_FOR,
      historic: index === 2,
      bookingRemark: 'Hidden booking remark',
      stages: [{ purpose: 'Projection stage', note: 'Hidden stage note' }],
      expenses: [],
      days: [],
      history: [],
      bookings: []
    }))
  )
})

test.serial('inclusion projections reject matching and nonmatching predicates on hidden user fields', async (t) => {
  const before = await User.collection.find({ _id: { $in: userIds } }).toArray()
  for (const filter of [
    { 'settings.bankAccount.iban': iban },
    { 'settings.bankAccount.iban': 'nonmatching' },
    { 'fk.httpBearer': { $regex: '^guess' } },
    { settings: { bankAccount: { iban } } },
    { $and: [{ $or: [{ 'settings.bankAccount.iban': iban }] }] },
    { $nor: [{ 'settings.bankAccount.iban': { $not: { $eq: iban } } }] }
  ]) {
    const response = await agent.get('/users').query(query({ _id: userIds[0].toString(), ...filter }))
    t.is(response.status, 422, JSON.stringify(filter))
    t.is(response.body.name, 'alerts.ValidationError')
    t.false('data' in response.body)
    t.false('meta' in response.body)
  }
  t.deepEqual(await User.collection.find({ _id: { $in: userIds } }).toArray(), before)
})

test.serial('project budgets and balances cannot be probed through a public projection', async (t) => {
  const before = await Project.collection.find({ _id: { $in: projectIds } }).toArray()
  for (const filter of [{ 'budget.amount': 100 }, { 'budget.amount': 101 }, { 'balance.amount': { $gte: 50 } }]) {
    const response = await agent.get('/project').query(query({ _id: projectIds[0].toString(), ...filter }))
    t.is(response.status, 422)
    t.is(response.body.name, 'alerts.ValidationError')
  }
  t.deepEqual(await Project.collection.find({ _id: { $in: projectIds } }).toArray(), before)
})

test.serial('visible fields retain logical, comparison, regex and membership filtering with exact counts', async (t) => {
  const response = await agent
    .get('/users')
    .query({
      ...query({
        _id: { $in: userIds.map(String) },
        $and: [
          { 'name.givenName': { $regex: '^projection$', $options: 'i' } },
          { $or: [{ 'name.familyName': 'Visible' }, { email: 'nonmatching@example.invalid' }] },
          { 'name.familyName': { $not: { $eq: 'Other' } } }
        ]
      }),
      limit: 1
    })
    .expect(200)
  t.deepEqual(
    response.body.data.map(({ _id }: { _id: string }) => _id),
    [userIds[0].toString()]
  )
  t.deepEqual(response.body.meta, { count: 1, countPages: 1, limit: 1, page: 1 })
  t.false('settings' in response.body.data[0])
  const empty = await agent
    .get('/users')
    .query(query({ _id: { $in: userIds.map(String) }, 'name.familyName': 'Missing' }))
    .expect(200)
  t.deepEqual(empty.body.data, [])
  t.is(empty.body.meta.count, 0)
})

test.serial('partial nested projections allow visible array children but reject hidden siblings and parent comparisons', async (t) => {
  const before = await Organisation.collection.findOne({ _id: organisationId })
  for (const filter of [
    { 'accountingSettings.vatRates.rate': 7 },
    { 'accountingSettings.vatRates.1.rate': { $gte: 7, $lte: 7 } },
    { 'accountingSettings.vatRates': { $elemMatch: { rate: 7 } } },
    { 'accountingSettings.vatRates': { $all: [{ $elemMatch: { rate: 7 } }] } }
  ]) {
    const response = await agent
      .get('/organisation')
      .query(query({ _id: organisationId.toString(), ...filter }))
      .expect(200)
    t.deepEqual(
      response.body.data.map(({ _id }: { _id: string }) => _id),
      [organisationId.toString()]
    )
    t.is(response.body.meta.count, 1)
    t.deepEqual(response.body.data[0].accountingSettings.vatRates, [{ rate: 0 }, { rate: 7 }])
  }
  for (const filter of [
    { 'accountingSettings.vatRates.1.inputTaxAccount': { $exists: true } },
    { 'accountingSettings.vatRates': { $elemMatch: { inputTaxAccount: { $exists: true } } } },
    { 'accountingSettings.vatRates': { $all: [{ $elemMatch: { inputTaxAccount: { $exists: true } } }] } },
    { 'accountingSettings.vatRates': { $not: { $elemMatch: { inputTaxAccount: { $exists: true } } } } },
    { 'accountingSettings.vatRates': { $eq: [{ rate: 7 }] } },
    { accountingSettings: { vatAccountingEnabled: true } }
  ]) {
    const response = await agent.get('/organisation').query(query({ _id: organisationId.toString(), ...filter }))
    t.is(response.status, 422, JSON.stringify(filter))
    t.is(response.body.name, 'alerts.ValidationError')
  }
  t.deepEqual(await Organisation.collection.findOne({ _id: organisationId }), before)
})

test.serial('exclusion projections check additional fields and preserve server ownership and history restrictions', async (t) => {
  const before = await Travel.collection.find({ _id: { $in: travelIds } }).toArray()
  const ids = { _id: { $in: travelIds.map(String) } }
  for (const filter of [
    { 'stages.note': 'Hidden stage note' },
    { 'stages.0.note': 'Hidden stage note' },
    { stages: { $elemMatch: { note: 'Hidden stage note' } } },
    { stages: { $all: [{ $elemMatch: { note: 'Hidden stage note' } }] } },
    { bookingRemark: { $exists: true } },
    { historic: false }
  ]) {
    const response = await agent.get('/travel').query(query({ ...ids, ...filter }))
    t.is(response.status, 422, JSON.stringify(filter))
    t.is(response.body.name, 'alerts.ValidationError')
  }
  const publicResponse = await agent.get('/travel').query(query(ids)).expect(200)
  t.deepEqual(
    publicResponse.body.data.map(({ _id }: { _id: string }) => _id),
    [travelIds[0].toString()]
  )
  t.is(publicResponse.body.meta.count, 1)
  t.false('stages' in publicResponse.body.data[0])
  for (const stageFilter of [{ 'stages.0.note': 'Hidden stage note' }, { stages: { $elemMatch: { note: 'Hidden stage note' } } }]) {
    const response = await agent
      .get('/travel')
      .query({ ...query({ ...ids, ...stageFilter }), additionalFields: ['stages'] })
      .expect(200)
    t.deepEqual(
      response.body.data.map(({ _id }: { _id: string }) => _id),
      [travelIds[0].toString()]
    )
    t.is(response.body.meta.count, 1)
    t.is(response.body.data[0].stages[0].note, 'Hidden stage note')
  }
  const forbidden = await agent
    .get('/travel')
    .query({ ...query({ ...ids, bookingRemark: 'Hidden booking remark' }), additionalFields: ['bookingRemark'] })
  t.is(forbidden.status, 422)
  t.deepEqual(await Travel.collection.find({ _id: { $in: travelIds } }).toArray(), before)
})

test.serial('opaque operators are rejected even without a restrictive projection', async (t) => {
  for (const filter of [
    { $expr: { $eq: ['$settings.bankAccount.iban', iban] } },
    { $where: 'this.settings.bankAccount.iban.length > 0' },
    { $text: { $search: 'secret' } },
    { $jsonSchema: { required: ['settings'] } },
    { $or: [{ $expr: { $literal: true } }] },
    { name: { $unknown: true } },
    { 'projects.assigned': { $elemMatch: { $where: 'true' } } }
  ]) {
    for (const endpoint of ['/users', '/admin/project']) {
      const response = await (endpoint.startsWith('/admin') ? admin : agent).get(endpoint).query(query(filter))
      t.is(response.status, 422, `${endpoint}: ${JSON.stringify(filter)}`)
      t.is(response.body.name, 'alerts.ValidationError')
    }
  }
})

test.serial('malformed filter structures return validation errors', async (t) => {
  for (const filter of [
    null,
    [],
    1,
    'invalid',
    { $and: {} },
    { $or: [] },
    { $nor: [null] },
    { name: { $not: null } },
    { name: { $in: 1 } },
    { name: { $elemMatch: [] } },
    { name: { $all: {} } },
    { 'name..givenName': 'Projection' }
  ]) {
    const response = await agent.get('/users').query(query(filter))
    t.is(response.status, 422, JSON.stringify(filter))
    t.is(response.body.name, 'alerts.ValidationError')
  }
  const invalidJSON = await agent.get('/users').query({ filterJSON: Base64.encode('{') })
  t.is(invalidJSON.status, 422)
  t.is(invalidJSON.body.name, 'alerts.ValidationError')
})

test.serial('ID lookups validate supplied filters while retaining the existing lookup behavior', async (t) => {
  const rejected = await agent.get('/users').query({ _id: userIds[0].toString(), ...query({ 'settings.bankAccount.iban': iban }) })
  t.is(rejected.status, 422)
  t.is(rejected.body.name, 'alerts.ValidationError')
  const accepted = await agent
    .get('/users')
    .query({ _id: userIds[0].toString(), ...query({ email: 'nonmatching@example.invalid' }) })
    .expect(200)
  t.is(accepted.body.data._id, userIds[0].toString())
  t.false('settings' in accepted.body.data)
})

test.serial('unrestricted projections keep legitimate administrative filters working', async (t) => {
  const response = await admin
    .get('/admin/project')
    .query(query({ _id: projectIds[0].toString(), 'budget.amount': 100 }))
    .expect(200)
  t.deepEqual(
    response.body.data.map(({ _id }: { _id: string }) => _id),
    [projectIds[0].toString()]
  )
  t.is(response.body.data[0].budget.amount, 100)
  t.is(response.body.meta.count, 1)
})

test.after.always(async () => {
  try {
    await Travel.collection.deleteMany({ _id: { $in: travelIds } })
    await Project.collection.deleteMany({ _id: { $in: projectIds } })
    await Organisation.collection.deleteOne({ _id: organisationId })
    await User.collection.deleteMany({ _id: { $in: userIds } })
  } finally {
    await shutdown()
  }
})
