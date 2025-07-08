import { App, Plugin } from 'vue'
import Formatter from '../../common/formatter'
import { getLanguageFromNavigator } from './i18n'

export const formatter = new Formatter(getLanguageFromNavigator(), 'givenNameFirst')

const FormatterPlugin: Plugin = {
  install(app: App, _options: unknown) {
    app.config.globalProperties.$formatter = formatter
  }
}

export default FormatterPlugin
