import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('indexedDB', new IDBFactory())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('does not open the database on import and shares one connection between concurrent requests', async () => {
  const open = vi.spyOn(indexedDB, 'open')
  const { readAuthContext, hasLogoutTombstone } = await import('../src/indexedDB.js')
  expect(open).not.toHaveBeenCalled()
  expect(await Promise.all([readAuthContext(), hasLogoutTombstone()])).toEqual([undefined, false])
  expect(open).toHaveBeenCalledExactlyOnceWith('abrechnung-db', 3)
})

it('defers the v2 migration until use, purges private responses and preserves UI preferences', async () => {
  const oldDB = await openDB('abrechnung-db', 2, {
    upgrade(db) {
      db.createObjectStore('urls')
      db.createObjectStore('columnOrder')
    }
  })
  const columns = [{ value: 'name', text: 'Name' }]
  await oldDB.put('urls', { data: { private: true }, timestamp: Date.now() }, '/user')
  await oldDB.put('columnOrder', columns, 'reports')
  oldDB.close()

  const { readFromDB } = await import('../src/indexedDB.js')
  expect(await indexedDB.databases()).toEqual([{ name: 'abrechnung-db', version: 2 }])
  expect(await readFromDB('columnOrder', 'reports')).toEqual(columns)
  expect(await readFromDB('urls', '/user')).toBeUndefined()
  expect(await indexedDB.databases()).toEqual([{ name: 'abrechnung-db', version: 3 }])
})
