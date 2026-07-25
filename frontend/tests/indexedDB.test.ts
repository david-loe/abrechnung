import type { AuthContext } from 'abrechnung-common/types.js'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStore,
  createRequestCacheKey,
  purgePrivateData,
  readAuthContext,
  readRequestFromDB,
  storeAuthContext,
  storeRequestToDB
} from '@/indexedDB.js'

const context = (cacheScope: string, expiresAt = new Date(Date.now() + 60_000).toISOString()): AuthContext => ({
  userId: '507f1f77bcf86cd799439011',
  cacheScope,
  expiresAt,
  permissions: {}
})

beforeEach(async () => {
  await clearStore('urls')
  await clearStore('session')
})

describe('offline request cache', () => {
  it('canonicalizes query parameters and partitions keys by cache scope', () => {
    const left = createRequestCacheKey('http://backend.test/travel?b=2&a=1', context('scope-a'))
    const right = createRequestCacheKey('http://backend.test/travel?a=1&b=2', context('scope-a'))
    expect(left).toBe(right)
    expect(createRequestCacheKey('http://backend.test/travel?a=1&b=2', context('scope-b'))).not.toBe(right)
  })

  it('never returns an entry through another authentication scope', async () => {
    const owner = context('scope-a')
    await storeAuthContext(owner)
    const key = createRequestCacheKey('http://backend.test/travel', owner)
    await storeRequestToDB({ data: [], meta: { count: 0, page: 1, limit: 10, countPages: 0 } }, key, owner)
    expect(await readRequestFromDB(key, owner)).not.toBeNull()
    expect(await readRequestFromDB(key, context('scope-b'))).toBeNull()
  })

  it('drops expired entries and purges private data without deleting UI preferences', async () => {
    const expired = context('scope-a', new Date(Date.now() - 1).toISOString())
    await storeAuthContext(expired)
    const key = createRequestCacheKey('http://backend.test/travel', expired)
    await storeRequestToDB({ data: [], meta: { count: 0, page: 1, limit: 10, countPages: 0 } }, key, expired)
    expect(await readRequestFromDB(key, expired)).toBeNull()
    await purgePrivateData()
    expect(await readAuthContext()).toBeUndefined()
  })
})
