import { prepareDatabase } from './databaseSetup.js'
import { disconnectDB } from './db.js'

try {
  await prepareDatabase()
} finally {
  await disconnectDB()
}
