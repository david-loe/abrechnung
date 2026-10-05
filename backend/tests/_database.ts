import { connectDB } from '../db.js'

export function connectTestDatabase() {
  return connectDB(false, { autoIndex: false, autoCreate: false })
}
