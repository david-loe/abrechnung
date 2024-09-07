import { connectDB } from './db.js'
import { checkForMigrations } from './migrations.js'

await connectDB()
await checkForMigrations()
