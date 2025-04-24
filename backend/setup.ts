import APP from './app.js'
import { disconnectDB } from './db.js'

await APP()
await disconnectDB()
