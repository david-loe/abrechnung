import { loadLocales } from 'abrechnung-common/locales/load.js'
import { defaultLocale, Locale, locales } from 'abrechnung-common/types.js'
import { createI18n, DefaultLocaleMessageSchema, I18n } from 'vue-i18n'

export function getLanguageFromNavigator() {
  // language code without region
  let language = navigator.language.split('-')[0] || defaultLocale

  if (locales.indexOf(language as Locale) === -1) {
    // default to English if the language is not supported
    language = 'en'
  }
  return language as Locale
}

export default createI18n<DefaultLocaleMessageSchema, Locale, false>({
  legacy: false,
  locale: getLanguageFromNavigator(),
  fallbackLocale: defaultLocale,
  messages: loadLocales(),
  globalInjection: true
}) as I18n<{}, {}, {}, Locale, false>
