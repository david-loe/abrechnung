import mongoose from 'mongoose'
import { connectDB } from './db.js'
import { checkForMigrations } from './migrations.js'

export async function prepareDatabase() {
  await connectDB(true, { autoIndex: false, autoCreate: false })
  await checkForMigrations()
  await mongoose.syncIndexes()
}
