import { createI18n } from 'vue-i18n'
import { Locale, locales } from '../../common/types.js'

const emptyMessages = {} as { [key in Locale]: {} }
for (const locale of locales) {
  emptyMessages[locale] = {}
}

export default createI18n<any, Locale>({
  legacy: false,
  locale: 'de',
  fallbackLocale: 'de',
  messages: emptyMessages,
  globalInjection: true
})
