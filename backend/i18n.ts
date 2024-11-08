import i18next, { Resource } from 'i18next'
import Formatter from '../common/formatter.js'
import { loadLocales } from '../common/locales/load.js'
import { Locale } from '../common/types.js'
import { getDisplaySettings } from './db.js'

const displaySettings = await getDisplaySettings()
function loadLocaleMessages() {
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

export const formatter = new Formatter(displaySettings.locale.default)
