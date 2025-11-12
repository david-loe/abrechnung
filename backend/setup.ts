import APP, { shutdown } from './app.js'

await APP()

// sleep 5 seconds
await new Promise((resolve) => setTimeout(resolve, 5000))

await shutdown()
