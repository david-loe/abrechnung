import APP from './app.js'
import { disconnectDB } from './db.js'

await APP()

// sleep 5 seconds
await new Promise((resolve) => setTimeout(resolve, 5000))

await disconnectDB()
