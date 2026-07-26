import mongoose from 'mongoose'
import { connectDB, disconnectDB } from './db.js'
import { checkForMigrations } from './migrations.js'

try {
  await connectDB()
  await checkForMigrations()
  await mongoose.syncIndexes()
} finally {
  await disconnectDB()
}
