const i18next = require("i18next")
const fs = require('fs');

/**
 * Load locale messages
 *
 * The loaded `JSON` locale messages is pre-compiled by `@intlify/vue-i18n-loader`, which is integrated into `vue-cli-plugin-i18n`.
 * See: https://github.com/intlify/vue-i18n-loader#rocket-i18n-resource-pre-compilation
 */
function loadLocaleMessages() {
  const messages = {}
  fs.readdirSync('./common/locales').forEach(file => {
    const matched = file.match(/([A-Za-z0-9-_]+)\./i)
    if (matched && matched.length > 1) {
      const rawdata = fs.readFileSync('./common/locales/' + file)
      const locale = matched[1]
      messages[locale] = { translation: JSON.parse(rawdata) }
    }
  });
  return messages
}

i18next.init({
  legacy: false,
  lng: process.env.VUE_APP_I18N_LOCALE || 'de',
  fallbackLng: process.env.VUE_APP_I18N_FALLBACK_LOCALE || 'de',
  resources: loadLocaleMessages(),
  globalInjection: true,
  interpolation: {
    prefix: "{",
    suffix: "}",
    nestingPrefix: "@:{'",
    nestingSuffix: "'}"
  }
})

module.exports = i18next

