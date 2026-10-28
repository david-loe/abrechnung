import { type User as IUser } from 'abrechnung-common/types.js'
import test, { type ExecutionContext } from 'ava'
import { Types } from 'mongoose'
import { findOrCreateUser } from '../authStrategies/index.js'
import { verifyOidcTokens } from '../authStrategies/oidc.js'
import { AuthorizationError } from '../controller/error.js'
import settings from '../data/settings.js'
import User from '../models/user.js'
import createAgent, { loginUser, shutdown } from './_agent.js'

const agent = await createAgent()
await loginUser(agent, 'admin')
const prefix = `auth-example-${new Types.ObjectId()}`
const profile = { email: `${prefix}@example.invalid`, name: 'Test Administrator' }
const userData = { email: profile.email, name: { givenName: 'Test', familyName: 'Administrator' } }

function tokensWithClaims(claims: unknown) {
  return { claims: () => claims } as Parameters<typeof verifyOidcTokens>[0]
}

async function storedUsers(email = profile.email) {
  const response = await agent
    .get('/admin/user')
    .query({ filterJSON: Buffer.from(JSON.stringify({ email })).toString('base64') })
    .expect(200)
  return response.body.data as IUser<string>[]
}

function assertRejected(t: ExecutionContext, results: unknown[][], message: string) {
  t.is(results.length, 1)
  const [error, user] = results[0]
  t.true(error instanceof AuthorizationError)
  t.is((error as AuthorizationError).status, 401)
  t.is((error as Error).message, message)
  t.is(user, undefined)
}

const invalidSubjects = [
  { label: 'absent claims', claims: undefined },
  { label: 'null claims', claims: null },
  { label: 'omitted subject', claims: profile },
  ...[undefined, null, '', 0, false, {}, []].map((sub) => ({ label: `subject ${JSON.stringify(sub)}`, claims: { ...profile, sub } })),
  { label: 'missing subject and profile fields', claims: {} }
]

for (const { label, claims } of invalidSubjects) {
  test.serial(`given ${label}, OIDC refuses authentication and leaves users unchanged`, async (t) => {
    const before = await storedUsers()
    const results: unknown[][] = []
    await verifyOidcTokens(tokensWithClaims(claims), (...args) => results.push(args))
    assertRejected(t, results, 'Missing or invalid OIDC sub claim')
    t.deepEqual(await storedUsers(), before)
  })
}

const invalidFilters: { label: string; filter: IUser['fk'] }[] = [
  { label: 'empty filter', filter: {} },
  { label: 'inherited identity only', filter: Object.create({ oidc: 'inherited-subject' }) },
  { label: 'mixed valid and invalid identities', filter: { oidc: 'valid-subject', microsoft: null } },
  ...(['oidc', 'ldapauth', 'microsoft', 'magiclogin', 'httpBearer'] as const).flatMap((key) =>
    [undefined, null, '', 0, false, {}, []].map((value) => ({
      label: `${key} ${JSON.stringify(value)}`,
      filter: { [key]: value } as IUser['fk']
    }))
  )
]

for (const { label, filter } of invalidFilters) {
  test.serial(`given ${label}, the identity adapter rejects authentication without changing users`, async (t) => {
    const before = await storedUsers()
    const results: unknown[][] = []
    await findOrCreateUser(filter, userData, (...args) => results.push(args))
    assertRejected(t, results, 'Missing or invalid authentication identity')
    t.deepEqual(await storedUsers(), before)
  })
}

for (const key of ['oidc', 'ldapauth', 'microsoft'] as const) {
  test.serial(`given an existing ${key} identity, authentication preserves its spelling and access`, async (t) => {
    const email = `${prefix}-${key}@example.invalid`
    const identity = ` ${prefix}-${key} `
    const existing = await User.create({ ...userData, email, fk: { [key]: identity }, access: { user: true, admin: true } })
    const results: unknown[][] = []
    await findOrCreateUser({ [key]: identity }, { ...userData, email }, (...args) => results.push(args))
    t.is(results.length, 1)
    t.is(results[0][0], null)
    const users = await storedUsers(email)
    t.is(users.length, 1)
    t.is(users[0]._id, existing._id.toString())
    t.true(users[0].access.admin)
    t.is(users[0].fk[key], identity)
  })
}

test.serial(
  'given a new OIDC identity with a known email, authentication links it without replacing access or LDAP identity',
  async (t) => {
    const email = `${prefix}-link@example.invalid`
    const existing = await User.create({ ...userData, email, fk: { ldapauth: `${prefix}-ldap` }, access: { user: true, admin: true } })
    const results: unknown[][] = []
    await verifyOidcTokens(tokensWithClaims({ ...profile, email, sub: `${prefix}-new` }), (...args) => results.push(args))
    t.is(results.length, 1)
    t.is(results[0][0], null)
    const users = await storedUsers(email)
    t.is(users.length, 1)
    t.is(users[0]._id, existing._id.toString())
    t.is(users[0].fk.oidc, `${prefix}-new`)
    t.is(users[0].fk.ldapauth, `${prefix}-ldap`)
    t.true(users[0].access.admin)
  }
)

test.serial('given a new OIDC identity and email, authentication persists a user with default access', async (t) => {
  const results: unknown[][] = []
  await verifyOidcTokens(tokensWithClaims({ ...profile, sub: prefix }), (...args) => results.push(args))
  t.is(results.length, 1)
  t.is(results[0][0], null)
  const users = await storedUsers()
  t.is(users.length, 1)
  t.is(users[0].fk.oidc, prefix)
  t.like(users[0].name, userData.name)
  t.like(users[0].access, settings.defaultAccess)
})

test.after.always(async () => {
  try {
    await User.deleteMany({ email: { $regex: `^${prefix}` } })
  } finally {
    await shutdown()
  }
})
