import { App, Plugin } from 'vue'
import Formatter from '../../common/formatter'
import { defaultLocale } from '../../common/types'

export const formatter = new Formatter(defaultLocale)

const FormatterPlugin: Plugin = {
  install(app: App, options: any) {
    app.config.globalProperties.$formatter = formatter
  }
}

export default FormatterPlugin
