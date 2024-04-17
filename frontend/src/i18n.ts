import { createI18n } from 'vue-i18n'
import { loadLocales } from '../../common/locales/load.js'
import { Locale } from '../../common/types.js'

const messages = loadLocales(import.meta.env.VITE_I18N_LOCALES_OVERWRITE)

export default createI18n<typeof messages.de, Locale>({
  legacy: false,
  locale: import.meta.env.VITE_I18N_LOCALE || 'de',
  fallbackLocale: import.meta.env.VITE_I18N_FALLBACK_LOCALE || 'de',
  messages: messages,
  globalInjection: true
})
