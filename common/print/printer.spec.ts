import test from 'ava'
import printerSettings from './printerSettings.js'

test('printerSettings default exist', (t) => {
  t.truthy(printerSettings)
})
