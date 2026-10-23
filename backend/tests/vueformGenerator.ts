import test from 'ava'
import { mongooseSchemaToVueformSchema } from '../models/vueformGenerator.js'

const defaults = [
  ['enabled', Boolean, true],
  ['disabled', Boolean, false],
  ['language', String, 'en'],
  ['emptyText', String, ''],
  ['amount', Number, 42],
  ['zero', Number, 0],
  ['date', Date, new Date('2026-01-01T00:00:00Z')],
  ['emptyList', [{ type: String }], []],
  ['list', [{ type: String }], ['example']]
] as const

for (const [name, type, value] of defaults) {
  for (const functional of [false, true]) {
    test(`serializes ${functional ? 'function' : 'literal'} default for ${name}`, (t) => {
      const schema = mongooseSchemaToVueformSchema({ [name]: { type, default: functional ? () => value : value } }, 'en')
      const serialized = JSON.parse(JSON.stringify(schema))

      t.deepEqual(serialized[name].default, JSON.parse(JSON.stringify(value)))
    })
  }
}

test('serializes defaults in nested objects and list entries', (t) => {
  const schema = mongooseSchemaToVueformSchema(
    {
      settings: { type: { language: { type: String, default: () => 'en' } } },
      accounts: { type: [{ type: { enabled: { type: Boolean, default: () => false } } }], default: () => [] }
    },
    'en'
  )
  const serialized = JSON.parse(JSON.stringify(schema))

  t.is(serialized.settings.schema.language.default, 'en')
  t.deepEqual(serialized.accounts.default, [])
  t.is(serialized.accounts.object.schema.enabled.default, false)
})

test('resolves current defaults and creates fresh arrays on every conversion', (t) => {
  let language = 'en'
  const definition = { language: { type: String, default: () => language }, accounts: { type: [{ type: String }], default: () => [] } }
  const first = mongooseSchemaToVueformSchema(definition, 'en')
  language = 'de'
  const second = mongooseSchemaToVueformSchema(definition, 'en')

  t.is(first.language.default, 'en')
  t.is(second.language.default, 'de')
  t.deepEqual(first.accounts.default, [])
  t.deepEqual(second.accounts.default, [])
  t.not(first.accounts.default, second.accounts.default)
})

test('omits absent and null defaults', (t) => {
  const schema = mongooseSchemaToVueformSchema(
    { absent: { type: String }, undefined: { type: String, default: undefined }, null: { type: String, default: null } },
    'en'
  )

  for (const name of ['absent', 'undefined', 'null']) {
    t.false(Object.hasOwn(schema[name], 'default'))
  }
})
