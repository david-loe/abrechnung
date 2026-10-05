import { mock } from 'node:test'
import displaySettings from 'abrechnung-common/data/displaySettings.js'
import { tokenAdminUser } from 'abrechnung-common/types.js'
import test from 'ava'
import { Request } from 'express'
import passport from 'passport'
import '../auth.js'
import usageTokenStrategy from '../authStrategies/usage-token.js'
import { expressAuthentication } from '../controller/authentication.js'
import settings from '../data/settings.js'
import { BACKEND_CACHE } from '../db.js'
import { logger } from '../logger.js'
import User from '../models/user.js'
import { recordUserActivity } from '../userActivity.js'

const now = new Date('2026-10-05T12:00:00Z')

test.beforeEach(() => {
  mock.timers.enable({ apis: ['Date'], now })
  mock.getter(BACKEND_CACHE, 'settings', () => settings)
  mock.getter(BACKEND_CACHE, 'displaySettings', () => displaySettings)
})

test.afterEach.always(() => {
  mock.restoreAll()
  mock.timers.reset()
})

function user(lastActiveAt?: Date) {
  const value = new User({
    email: 'activity@example.com',
    name: { givenName: 'Activity', familyName: 'Test' },
    fk: {},
    access: { user: true },
    lastActiveAt
  })
  value.unmarkModified('lastActiveAt')
  return value
}

test.serial('first activity updates the response without dirtying the persisted timestamp', async (t) => {
  const value = user()
  const update = mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }))
  await recordUserActivity(value)
  t.is(update.mock.callCount(), 1)
  t.deepEqual(value.lastActiveAt, now)
  t.false(value.isModified('lastActiveAt'))
})

test.serial('activity within five minutes does not write; the boundary does', async (t) => {
  const value = user(new Date(now.valueOf() - 299_999))
  const update = mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }))
  await recordUserActivity(value)
  t.is(update.mock.callCount(), 0)
  mock.timers.tick(1)
  await recordUserActivity(value)
  t.is(update.mock.callCount(), 1)
  t.deepEqual(value.lastActiveAt, new Date(now.valueOf() + 1))
})

test.serial('successful session login records activity immediately', async (t) => {
  const value = user(new Date(now.valueOf() - 1000))
  const update = mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }))
  const session = await new Promise((resolve, reject) => {
    passport.serializeUser(value, (error: unknown, result: unknown) => (error ? reject(error) : resolve(result)))
  })
  t.deepEqual(session, { _id: value._id })
  t.deepEqual(value.lastActiveAt, now)
  t.is(update.mock.callCount(), 1)
})

test.serial('timestamps in the future are never moved backwards, including at login', async (t) => {
  const value = user(new Date(now.valueOf() + 1000))
  const update = mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }))
  await recordUserActivity(value)
  await recordUserActivity(value, true)
  t.is(update.mock.callCount(), 0)
})

test.serial('a concurrent update does not mark a stale document for saving', async (t) => {
  const previous = new Date(now.valueOf() - 600_000)
  const value = user(previous)
  mock.method(User, 'updateOne', async () => ({ modifiedCount: 0 }))
  await recordUserActivity(value)
  t.deepEqual(value.lastActiveAt, previous)
  t.false(value.isModified('lastActiveAt'))
})

test.serial('activity write failure is logged and does not reject an authorized request', async (t) => {
  const value = user()
  const error = new Error('Database unavailable')
  mock.method(User, 'updateOne', async () => {
    throw error
  })
  const warning = mock.method(logger, 'warn', () => {})
  const request = { user: value, isAuthenticated: () => true } as unknown as Request
  t.is(await expressAuthentication(request, 'cookieAuth', ['user']), value)
  t.is(value.lastActiveAt, undefined)
  t.is(warning.mock.callCount(), 1)
  t.is(warning.mock.calls[0].arguments[1], error)
})

test.serial('unauthenticated, inactive and unauthorized requests do not record activity', async (t) => {
  const value = user()
  value.access.admin = false
  const update = mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }))
  const request = { user: value, isAuthenticated: () => false } as unknown as Request
  await t.throwsAsync(expressAuthentication(request, 'cookieAuth', ['user']))
  request.isAuthenticated = (() => true) as Request['isAuthenticated']
  await t.throwsAsync(expressAuthentication(request, 'cookieAuth', ['admin']))
  value.access.user = false
  await t.throwsAsync(expressAuthentication(request, 'cookieAuth', ['user']))
  t.is(update.mock.callCount(), 0)
})

test.serial('technical usage token does not record user activity', async (t) => {
  const update = mock.method(User, 'updateOne', async () => ({ modifiedCount: 1 }))
  mock.method(usageTokenStrategy, 'authenticate', function (this: passport.StrategyCreated<passport.Strategy>) {
    this.success(tokenAdminUser as Express.User)
  })
  const authenticated = await expressAuthentication({} as Request, 'usageToken', ['admin'])
  t.true(authenticated === tokenAdminUser)
  t.is(update.mock.callCount(), 0)
})

test.serial('activity write failure does not reject a session login', async (t) => {
  const value = user()
  mock.method(User, 'updateOne', async () => {
    throw new Error('Database unavailable')
  })
  const warning = mock.method(logger, 'warn', () => {})
  const session = await new Promise((resolve, reject) => {
    passport.serializeUser(value, (error: unknown, result: unknown) => (error ? reject(error) : resolve(result)))
  })
  t.deepEqual(session, { _id: value._id })
  t.is(warning.mock.callCount(), 1)
})
