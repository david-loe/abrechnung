import { AuthContext, GETResponse } from 'abrechnung-common/types.js'
import { DBSchema, openDB, StoreKey, StoreNames, StoreValue } from 'idb'

const CACHE_PREFIX = 'abrechnung' as const
const INDEXED_DB_NAME = `${CACHE_PREFIX}-db`
const INDEXED_DB_VERSION = 3

export interface IndexedDB extends DBSchema {
  urls: { key: string; value: { data: GETResponse<unknown>; timestamp: number; expiresAt: number; cacheScope: string } }
  columnOrder: { key: string; value: { value: string; text: string }[] }
  session: { key: 'authContext' | 'logoutTombstone'; value: AuthContext | true }
}
const dbPromise = openDB<IndexedDB>(INDEXED_DB_NAME, INDEXED_DB_VERSION, {
  upgrade(db, oldVersion) {
    // v2 entries were not partitioned by user/session and must never be reused.
    if (oldVersion < 3 && db.objectStoreNames.contains('urls')) db.deleteObjectStore('urls')
    if (!db.objectStoreNames.contains('urls')) db.createObjectStore('urls')
    if (!db.objectStoreNames.contains('columnOrder')) {
      db.createObjectStore('columnOrder')
    }
    if (!db.objectStoreNames.contains('session')) db.createObjectStore('session')
  }
})

export async function storeToDB<Name extends StoreNames<IndexedDB>>(
  storeName: Name,
  value: StoreValue<IndexedDB, Name>,
  key?: StoreKey<IndexedDB, Name> | IDBKeyRange
) {
  return (await dbPromise).put(storeName, value, key)
}
export async function readFromDB<Name extends StoreNames<IndexedDB>>(storeName: Name, key: StoreKey<IndexedDB, Name> | IDBKeyRange) {
  return (await dbPromise).get(storeName, key)
}
export async function deleteFromDB<Name extends StoreNames<IndexedDB>>(storeName: Name, key: StoreKey<IndexedDB, Name> | IDBKeyRange) {
  return (await dbPromise).delete(storeName, key)
}
export async function clearStore(storeName: StoreNames<IndexedDB>) {
  return await (await dbPromise).clear(storeName)
}

export async function storeRequestToDB(data: GETResponse<unknown>, key: string, context: AuthContext) {
  const currentContext = await readAuthContext()
  if (!currentContext || currentContext.cacheScope !== context.cacheScope) return
  const entry = {
    data,
    timestamp: Date.now(),
    expiresAt: Math.min(Date.parse(context.expiresAt), Date.now() + 86_400_000),
    cacheScope: context.cacheScope
  }
  await storeToDB('urls', entry, key)
}

export async function readRequestFromDB(key: string, context: AuthContext, ttlMillis = 86_400_000) {
  const entry = await readFromDB('urls', key)
  if (!entry) return null
  const age = Date.now() - entry.timestamp
  if (entry.cacheScope !== context.cacheScope || age > ttlMillis || Date.now() >= entry.expiresAt) {
    await deleteFromDB('urls', key)
    return null
  }
  return entry.data
}

export async function storeAuthContext(context: AuthContext) {
  await storeToDB('session', context, 'authContext')
}

export async function readAuthContext() {
  const value = await readFromDB('session', 'authContext')
  return value === true ? undefined : value
}

export async function setLogoutTombstone() {
  await storeToDB('session', true, 'logoutTombstone')
}

export async function hasLogoutTombstone() {
  return (await readFromDB('session', 'logoutTombstone')) === true
}

export async function clearLogoutTombstone() {
  await deleteFromDB('session', 'logoutTombstone')
}

export async function purgePrivateData() {
  const db = await dbPromise
  const transaction = db.transaction(['urls', 'session'], 'readwrite')
  await Promise.all([transaction.objectStore('urls').clear(), transaction.objectStore('session').delete('authContext')])
  await transaction.done
}

export function createRequestCacheKey(requestUrl: string, context: AuthContext) {
  const url = new URL(requestUrl, globalThis.location?.origin)
  const query = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey)
  )
  const normalizedQuery = new URLSearchParams(query).toString()
  return `${context.cacheScope}|GET|${url.pathname}${normalizedQuery ? `?${normalizedQuery}` : ''}`
}
