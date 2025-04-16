import { createI18n } from 'vue-i18n'
import de from '../../common/locales/de.json' with { type: 'json' }
import en from '../../common/locales/en.json' with { type: 'json' }
import { Locale, defaultLocale } from '../../common/types.js'

const defaultMessages = {
  de,
  en
}

export default createI18n<any, Locale>({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: defaultLocale,
  messages: defaultMessages,
  globalInjection: true
})
