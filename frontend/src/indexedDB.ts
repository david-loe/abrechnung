import { GETResponse } from 'abrechnung-common/types.js'
import { DBSchema, openDB, StoreKey, StoreNames, StoreValue } from 'idb'

const CACHE_PREFIX = 'abrechnung' as const
const INDEXED_DB_NAME = `${CACHE_PREFIX}-db`
const INDEXED_DB_VERSION = 2

export interface IndexedDB extends DBSchema {
  urls: { key: string; value: { data: GETResponse<unknown>; timestamp: number } }
  columnOrder: { key: string; value: { value: string; text: string }[] }
}
const dbPromise = openDB<IndexedDB>(INDEXED_DB_NAME, INDEXED_DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('urls')) {
      db.createObjectStore('urls')
    }
    if (!db.objectStoreNames.contains('columnOrder')) {
      db.createObjectStore('columnOrder')
    }
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

export async function storeRequestToDB(data: GETResponse<unknown>, key: string) {
  const entry = { data, timestamp: Date.now() }
  await storeToDB('urls', entry, key)
}

export async function readRequestFromDB(
  key: string,
  ttlMillis = 86_400_000 // 1 day
) {
  const entry = await readFromDB('urls', key)
  if (!entry) return null
  const age = Date.now() - entry.timestamp
  if (age > ttlMillis) {
    await deleteFromDB('urls', key)
    return null
  }
  return entry.data
}
