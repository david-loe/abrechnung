import { loadLocales } from 'abrechnung-common/locales/load.js'
import { Locale } from 'abrechnung-common/types.js'
import i18next, { Resource } from 'i18next'
import { getDisplaySettings } from './db.js'

const displaySettings = await getDisplaySettings(false)

async function loadLocaleMessages() {
  const messages: Resource = {}
  const locales = loadLocales(displaySettings.locale.overwrite)
  for (const lang in locales) {
    messages[lang] = { translation: locales[lang as Locale] }
  }
  return messages
}

const i18n = i18next.createInstance({
  lng: displaySettings.locale.default,
  fallbackLng: displaySettings.locale.fallback,
  resources: await loadLocaleMessages(),
  nsSeparator: false,
  interpolation: { prefix: '{', suffix: '}', nestingPrefix: "@:{'", nestingSuffix: "'}" }
})

await i18n.init()

export default i18n
