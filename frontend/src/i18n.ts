import { createI18n, DefaultLocaleMessageSchema } from 'vue-i18n'
import de from '../../common/locales/de.json' with { type: 'json' }
import en from '../../common/locales/en.json' with { type: 'json' }
import { defaultLocale, Locale, locales } from '../../common/types.js'

const defaultMessages = { de, en }

export function getLanguageFromNavigator() {
  // language code without region
  let language = navigator.language.split('-')[0] || defaultLocale

  if (locales.indexOf(language as Locale) === -1) {
    // default to English if the language is not supported
    language = 'en'
  }
  return language as Locale
}

export default createI18n<DefaultLocaleMessageSchema, Locale>({
  legacy: false,
  locale: getLanguageFromNavigator(),
  fallbackLocale: defaultLocale,
  messages: defaultMessages,
  globalInjection: true
})
