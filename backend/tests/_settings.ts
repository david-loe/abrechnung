import type { Document, Filter, WithId } from 'mongodb'
import mongoose from 'mongoose'
import { BACKEND_CACHE } from '../db.js'

interface SettingsModel {
  collection: { name: string }
}

export async function withSettingsRestore<T>(
  model: SettingsModel,
  filter: Filter<Document>,
  callback: (originalSettings: WithId<Document>) => Promise<T>
) {
  const collection = mongoose.connection.collection<Document>(model.collection.name)
  const originalSettings = await collection.findOne(filter)
  if (!originalSettings) throw new Error(`${model.collection.name} settings missing`)

  try {
    return await callback(originalSettings)
  } finally {
    await collection.replaceOne({ _id: originalSettings._id }, originalSettings, { upsert: true })
    if (BACKEND_CACHE.initialized) await BACKEND_CACHE.reload(false)
  }
}
