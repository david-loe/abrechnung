import test from 'ava'
import printerSettings from './printerSettings.json' with { type: 'json' }

test('printerSettings default exist', (t) => {
  t.truthy(printerSettings)
})
