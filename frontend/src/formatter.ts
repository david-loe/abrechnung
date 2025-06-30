import { App, Plugin } from 'vue'
import Formatter from '../../common/formatter'
import { defaultLocale } from '../../common/types'

export const formatter = new Formatter(defaultLocale, 'givenNameFirst')

const FormatterPlugin: Plugin = {
  install(app: App, _options: unknown) {
    app.config.globalProperties.$formatter = formatter
  }
}

export default FormatterPlugin
