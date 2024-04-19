import i18next, { Resource } from 'i18next'
import { loadLocales } from '../common/locales/load.js'
import { Locale } from '../common/types.js'

function loadLocaleMessages() {
  const messages: Resource = {}
  const locales = loadLocales(process.env.VITE_I18N_LOCALES_OVERWRITE)
  for (const lang in locales) {
    messages[lang] = { translation: locales[lang as Locale] }
  }
  return messages
}

const i18n = i18next.createInstance({
  lng: process.env.VITE_I18N_LOCALE || 'de',
  fallbackLng: process.env.VITE_I18N_FALLBACK_LOCALE || 'de',
  resources: loadLocaleMessages(),
  nsSeparator: false,
  interpolation: {
    prefix: '{',
    suffix: '}',
    nestingPrefix: "@:{'",
    nestingSuffix: "'}"
  }
})

await i18n.init()

export default i18n
