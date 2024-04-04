import { defineConfig } from '@vueform/vueform'
import vueform from '@vueform/vueform/dist/vueform'
import de from '@vueform/vueform/locales/de'
import en from '@vueform/vueform/locales/en'

export default defineConfig({
  theme: vueform,
  locales: { de, en },
  locale: 'de',
  env: import.meta.env.MODE,
  validateOn: 'step',
  displayErrors: false,
  displayMessages: false
})
