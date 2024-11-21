import { App, Plugin } from 'vue'
import Formatter from '../../common/formatter'
import { defaultLocale } from '../../common/types'

const FormatterPlugin: Plugin = {
  install(app: App, options: any) {
    app.config.globalProperties.$formatter = new Formatter(defaultLocale)
  }
}

export default FormatterPlugin
