import { createI18n } from 'vue-i18n'
import de from './common/locales/de.json';
import en from './common/locales/en.json';

/**
 * Load locale messages
 *
 * The loaded `JSON` locale messages is pre-compiled by `@intlify/vue-i18n-loader`, which is integrated into `vue-cli-plugin-i18n`.
 * See: https://github.com/intlify/vue-i18n-loader#rocket-i18n-resource-pre-compilation
 */
function loadLocaleMessages() {
  const messages = {de, en}
  return messages
}

export default createI18n({
  legacy: false,
  locale: import.meta.env.VITE_I18N_LOCALE || 'de',
  fallbackLocale: import.meta.env.VITE_I18N_FALLBACK_LOCALE || 'de',
  messages: loadLocaleMessages(),
  globalInjection: true
})
