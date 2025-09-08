import Formatter from 'abrechnung-common/utils/formatter.js'
import { App, Plugin } from 'vue'
import { getLanguageFromNavigator } from './i18n'

export const formatter = new Formatter(getLanguageFromNavigator(), 'givenNameFirst')

const FormatterPlugin: Plugin = {
  install(app: App, _options: unknown) {
    app.config.globalProperties.$formatter = formatter
  }
}

export default FormatterPlugin
