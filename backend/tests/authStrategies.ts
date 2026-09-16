import { mock } from 'node:test'
import displaySettings from 'abrechnung-common/data/displaySettings.js'
import { User as IUser } from 'abrechnung-common/types.js'
import test, { ExecutionContext } from 'ava'
import { findOrCreateUser } from '../authStrategies/index.js'
import { verifyOidcTokens } from '../authStrategies/oidc.js'
import { AuthorizationError } from '../controller/error.js'
import settings from '../data/settings.js'
import { BACKEND_CACHE } from '../db.js'
import User from '../models/user.js'

const profile = { email: 'administrator@example.com', name: 'Test Administrator' }
const userData = { email: profile.email, name: { givenName: 'Test', familyName: 'Administrator' } }

function tokensWithClaims(claims: unknown) {
  return { claims: () => claims } as Parameters<typeof verifyOidcTokens>[0]
}

function rejectDatabaseAccess(t: ExecutionContext) {
  t.teardown(() => mock.restoreAll())
  const findOne = mock.method(User, 'findOne', () => {
    throw new Error('Unexpected user lookup')
  })
  const save = mock.method(User.prototype, 'save', () => {
    throw new Error('Unexpected user write')
  })
  return { findOne, save }
}

function assertRejected(t: ExecutionContext, calls: unknown[][], message: string) {
  t.is(calls.length, 1)
  const [error, user] = calls[0]
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
  test.serial(`OIDC rejects ${label} before accessing users`, async (t) => {
    const { findOne, save } = rejectDatabaseAccess(t)
    const calls: unknown[][] = []

    await verifyOidcTokens(tokensWithClaims(claims), (...args) => calls.push(args))

    assertRejected(t, calls, 'Missing or invalid OIDC sub claim')
    t.is(findOne.mock.callCount(), 0)
    t.is(save.mock.callCount(), 0)
  })
}

const identityKeys = ['oidc', 'ldapauth', 'microsoft', 'magiclogin', 'httpBearer'] as const
const invalidFilters: { label: string; filter: IUser['fk'] }[] = [
  { label: 'empty filter', filter: {} },
  { label: 'inherited identity only', filter: Object.create({ oidc: 'inherited-subject' }) },
  { label: 'mixed valid and invalid identities', filter: { oidc: 'valid-subject', microsoft: null } },
  ...identityKeys.flatMap((key) =>
    [undefined, null, '', 0, false, {}, []].map((value) => ({
      label: `${key} ${JSON.stringify(value)}`,
      filter: { [key]: value } as IUser['fk']
    }))
  )
]

for (const { label, filter } of invalidFilters) {
  test.serial(`user lookup rejects ${label} without querying or writing users`, async (t) => {
    const { findOne, save } = rejectDatabaseAccess(t)
    const calls: unknown[][] = []

    await findOrCreateUser(filter, userData, (...args) => calls.push(args))

    assertRejected(t, calls, 'Missing or invalid authentication identity')
    t.is(findOne.mock.callCount(), 0)
    t.is(save.mock.callCount(), 0)
  })
}

function stubUserPersistence(t: ExecutionContext) {
  t.teardown(() => mock.restoreAll())
  mock.getter(BACKEND_CACHE, 'settings', () => settings)
  mock.getter(BACKEND_CACHE, 'displaySettings', () => displaySettings)
  const save = mock.method(User.prototype, 'save', async function (this: InstanceType<typeof User>) {
    return this
  })
  mock.method(User, 'exists', async () => ({ _id: 'existing-admin' }))
  return save
}

for (const key of ['oidc', 'ldapauth', 'microsoft'] as const) {
  test.serial(`${key} matches a valid identity unchanged and preserves existing access`, async (t) => {
    const save = stubUserPersistence(t)
    const identity = ' Subject-123 '
    const existingUser = new User({ ...userData, fk: { [key]: identity }, access: { admin: true } })
    const findOne = mock.method(User, 'findOne', async () => existingUser)
    const calls: unknown[][] = []

    if (key === 'oidc') {
      await verifyOidcTokens(tokensWithClaims({ ...profile, sub: identity }), (...args) => calls.push(args))
    } else {
      await findOrCreateUser({ [key]: identity }, userData, (...args) => calls.push(args))
    }

    t.deepEqual(
      findOne.mock.calls.map((call) => call.arguments),
      [[{ [`fk.${key}`]: identity }]]
    )
    t.deepEqual(calls, [[null, existingUser]])
    t.is(save.mock.callCount(), 1)
    t.true(existingUser.access.admin)
    t.is(existingUser.fk[key], identity)
  })
}

test.serial('valid OIDC subject links the matching email user when the identity is new', async (t) => {
  const save = stubUserPersistence(t)
  const existingUser = new User({ ...userData, fk: { ldapauth: 'existing-ldap-id' }, access: { admin: true } })
  const findOne = mock.method(User, 'findOne', async (filter: Record<string, unknown>) => (filter.email ? existingUser : null))
  const calls: unknown[][] = []

  await verifyOidcTokens(tokensWithClaims({ ...profile, sub: 'new-subject' }), (...args) => calls.push(args))

  t.deepEqual(
    findOne.mock.calls.map((call) => call.arguments),
    [[{ 'fk.oidc': 'new-subject' }], [{ email: profile.email }]]
  )
  t.deepEqual(calls, [[null, existingUser]])
  t.is(save.mock.callCount(), 1)
  t.is(existingUser.fk.oidc, 'new-subject')
  t.is(existingUser.fk.ldapauth, 'existing-ldap-id')
  t.true(existingUser.access.admin)
})

test.serial('valid OIDC subject creates a user when neither identity nor email matches', async (t) => {
  const save = stubUserPersistence(t)
  const findOne = mock.method(User, 'findOne', async () => null)
  const calls: unknown[][] = []

  await verifyOidcTokens(tokensWithClaims({ ...profile, sub: 'new-subject' }), (...args) => calls.push(args))

  t.deepEqual(
    findOne.mock.calls.map((call) => call.arguments),
    [[{ 'fk.oidc': 'new-subject' }], [{ email: profile.email }]]
  )
  t.is(calls.length, 1)
  t.is(calls[0][0], null)
  const user = calls[0][1] as InstanceType<typeof User>
  t.true(user instanceof User)
  t.is(save.mock.callCount(), 1)
  t.is(save.mock.calls[0].this, user)
  t.is(user.fk.oidc, 'new-subject')
  t.is(user.email, profile.email)
  t.is(user.name.givenName, userData.name.givenName)
  t.is(user.name.familyName, userData.name.familyName)
  t.like(user.toObject().access, settings.defaultAccess)
})
