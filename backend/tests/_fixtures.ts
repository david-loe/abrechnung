import { isDeepStrictEqual } from 'node:util'
import mongoose from 'mongoose'
import { users } from './_users.js'

/** Restore only pre-existing shared fixtures, never clear the development database. */
export async function snapshotSharedFixtures() {
  const specifications = [
    { name: 'users', filter: { 'fk.ldapauth': { $in: Object.values(users).map(({ username }) => username) } } },
    ...[
      'settings',
      'connectionsettings',
      'displaysettings',
      'printersettings',
      'travelsettings',
      'integrationsettings',
      'organisations',
      'projects'
    ].map((name) => ({ name, filter: {} }))
  ]
  const snapshots = await Promise.all(
    specifications.map(async ({ name, filter }) => ({ name, documents: await mongoose.connection.collection(name).find(filter).toArray() }))
  )
  return async () => {
    for (const { name, documents } of snapshots) {
      if (documents.length === 0) continue
      const collection = mongoose.connection.collection(name)
      const current = await collection.find({ _id: { $in: documents.map(({ _id }) => _id) } }).toArray()
      const byId = new Map(current.map((document) => [document._id.toString(), document]))
      const changed = documents.filter((document) => !isDeepStrictEqual(document, byId.get(document._id.toString())))
      if (changed.length > 0) {
        await collection.bulkWrite(
          changed.map((document) => ({ replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true } }))
        )
      }
    }
  }
}

const fixtureModels = [
  'Travel',
  'ExpenseReport',
  'HealthCareCost',
  'Advance',
  'DocumentFile',
  'Token',
  'Project',
  'Category',
  'LedgerAccount',
  'User'
] as const

/** Only IDs returned by this test's mutations are candidates; unrelated new data is never swept. */
export async function createFixtureTracker() {
  const protectedIds = new Map(
    await Promise.all(fixtureModels.map(async (name) => [name, new Set((await mongoose.model(name).distinct('_id')).map(String))] as const))
  )
  const created = new Map(fixtureModels.map((name) => [name, new Set<string>()]))
  function record(name: (typeof fixtureModels)[number], value: unknown) {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      for (const item of value) record(name, item)
      return
    }
    const document = value as {
      _id?: unknown
      vehicleRegistration?: unknown[]
      expenses?: { cost?: { receipts?: unknown[] } }[]
      stages?: { cost?: { receipts?: unknown[] } }[]
    }
    const id = document._id ? String(document._id) : undefined
    if (id && !protectedIds.get(name)?.has(id)) created.get(name)?.add(id)
    for (const file of document.vehicleRegistration ?? []) record('DocumentFile', file)
    for (const item of [...(document.expenses ?? []), ...(document.stages ?? [])]) {
      for (const receipt of item.cost?.receipts ?? []) record('DocumentFile', receipt)
    }
  }
  return {
    recordResponse(path: string, result: unknown) {
      const parts = path.split('?')[0].split('/').filter(Boolean)
      if (['approve', 'examine', 'book', 'admin', 'create'].includes(parts[0])) parts.shift()
      const names: Record<string, (typeof fixtureModels)[number]> = {
        travel: 'Travel',
        expenseReport: 'ExpenseReport',
        healthCareCost: 'HealthCareCost',
        advance: 'Advance',
        user: 'User',
        project: 'Project',
        category: 'Category',
        ledgerAccount: 'LedgerAccount'
      }
      const name = parts[0] === 'user' && parts[1] === 'token' ? 'Token' : names[parts[0]]
      if (name) record(name, result)
    },
    async cleanup() {
      for (const name of fixtureModels) {
        for (const id of created.get(name) ?? []) {
          const document = await mongoose.model(name).findById(id)
          await document?.deleteOne()
        }
        created.get(name)?.clear()
      }
    }
  }
}
