import { connectDB } from '../db.js'
import { parseLumpSumsFiles } from './parser.js'

await connectDB()

parseLumpSumsFiles()
