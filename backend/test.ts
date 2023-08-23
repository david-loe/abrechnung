import test from 'ava'
import { testHistory } from './tests/travel.js'
import app from './app.js'

console.log(app.name)

test('Travel History', testHistory)
