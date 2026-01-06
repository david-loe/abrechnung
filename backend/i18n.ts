import { loadLocales } from 'abrechnung-common/locales/load.js'
import { DisplaySettings, Locale } from 'abrechnung-common/types.js'
import i18next, { Resource } from 'i18next'

async function loadLocaleMessages() {
  const messages: Resource = {}
  const locales = loadLocales()
  for (const lang in locales) {
    messages[lang] = { translation: locales[lang as Locale] }
  }
  return messages
}

const i18n = i18next.createInstance({
  lng: 'de',
  fallbackLng: 'de',
  resources: await loadLocaleMessages(),
  nsSeparator: false,
  interpolation: { prefix: '{', suffix: '}', nestingPrefix: "@:{'", nestingSuffix: "'}" }
})

await i18n.init()

export default i18n

export function updateI18n(localeSettings: DisplaySettings['locale']) {
  for (const l in localeSettings.overwrite) {
    const lang = l as Locale
    i18n.addResources(lang, 'translation', localeSettings.overwrite[lang])
  }
  if (localeSettings.default !== i18n.language) {
    i18n.changeLanguage(localeSettings.default)
  }
}
