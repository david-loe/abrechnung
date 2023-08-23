import { createI18n } from 'vue-i18n'
import de from '../../common/locales/de.json'
import en from '../../common/locales/en.json'
import { Locale } from '../../common/types.js'

type MessageSchema = typeof de

export default createI18n<MessageSchema, Locale>({
  legacy: false,
  locale: import.meta.env.VITE_I18N_LOCALE || 'de',
  fallbackLocale: import.meta.env.VITE_I18N_FALLBACK_LOCALE || 'de',
  messages: { de, en },
  globalInjection: true
})
