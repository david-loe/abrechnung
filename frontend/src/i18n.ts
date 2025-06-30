import { createI18n, DefaultLocaleMessageSchema } from 'vue-i18n'
import de from '../../common/locales/de.json' with { type: 'json' }
import en from '../../common/locales/en.json' with { type: 'json' }
import { defaultLocale, Locale } from '../../common/types.js'

const defaultMessages = { de, en }

export default createI18n<DefaultLocaleMessageSchema, Locale>({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: defaultLocale,
  messages: defaultMessages,
  globalInjection: true
})
