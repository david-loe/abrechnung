import { App, Plugin } from 'vue'
import Formatter from '../../common/formatter'

const FormatterPlugin: Plugin = {
  install(app: App, options: any) {
    app.config.globalProperties.$formatter = new Formatter(import.meta.env.VITE_I18N_LOCALE || 'de')
  }
}

export default FormatterPlugin
