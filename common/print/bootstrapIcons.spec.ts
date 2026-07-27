import test from 'ava'
import { getBootstrapIconGlyph } from './bootstrapIcons.js'

test('getBootstrapIconGlyph resolves configured Bootstrap icon names', (t) => {
  t.is(getBootstrapIconGlyph('airplane'), String.fromCodePoint(63437))
  t.is(getBootstrapIconGlyph('cash-coin'), String.fromCodePoint(63026))
})

test('getBootstrapIconGlyph ignores unknown and empty icon names', (t) => {
  t.is(getBootstrapIconGlyph('unknown-report-icon'), undefined)
  t.is(getBootstrapIconGlyph(''), undefined)
})
