import { defineConfig } from '@vueform/vueform'
import vueform from '@vueform/vueform/dist/vueform'
import de from '@vueform/vueform/locales/de'
import en from '@vueform/vueform/locales/en'

function deepReplace(obj: any, search: any, replacement: any) {
  for (const key in obj) {
    if (obj[key] === search) {
      obj[key] = replacement
    } else if (typeof obj[key] === 'object') {
      deepReplace(obj[key], search, replacement)
    }
  }
}

export default defineConfig({
  theme: vueform,
  locales: { de, en },
  locale: 'de',
  env: import.meta.env.MODE,
  displayErrors: false,
  displayMessages: false,
  endpoints: {},
  beforeSend(form$: any) {
    deepReplace(form$.data, null, undefined)
  }
})
