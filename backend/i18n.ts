import i18next from 'i18next'
import de from '../common/locales/de.json' assert { type: 'json' }
import en from '../common/locales/en.json' assert { type: 'json' }

function loadLocaleMessages() {
  const messages: i18next.Resource = {}
  messages.de = { translation: de }
  messages.en = { translation: en }

  return messages
}

const i18n = i18next.createInstance({
  lng: process.env.VITE_I18N_LOCALE || 'de',
  fallbackLng: process.env.VITE_I18N_FALLBACK_LOCALE || 'de',
  resources: loadLocaleMessages(),
  // globalInjection: true,
  interpolation: {
    prefix: '{',
    suffix: '}',
    nestingPrefix: "@:{'",
    nestingSuffix: "'}"
  }
})

export default i18n
