import test from 'ava'
import { loadLocales } from './load.js'

function translationKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child && typeof child === 'object' && !Array.isArray(child) ? translationKeys(child, path) : [path]
  })
}

test('all locales contain the same translation keys', (t) => {
  const messages = loadLocales()
  const referenceKeys = translationKeys(messages.de).sort()

  for (const [locale, translations] of Object.entries(messages)) {
    t.deepEqual(translationKeys(translations).sort(), referenceKeys, `${locale} translations are incomplete`)
  }
})
