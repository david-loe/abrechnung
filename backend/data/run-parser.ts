import '../db.js'
import { disconnectDB } from '../db.js'
import { parseLumpSumsFiles } from './parser.js'

await parseLumpSumsFiles()

disconnectDB()
