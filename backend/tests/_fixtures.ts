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
      'organisations'
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
