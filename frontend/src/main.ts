import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import vSelect from './vue-select'
import 'vue-select/dist/vue-select.css'
import './vue-select.css'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'

import i18n from './i18n'
import { CountrySimple, Currency } from '../../common/types'

// find windows user to give country flag web font on them
if (/windows/i.test(navigator.userAgent)) {
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.classList.add('win')
  }
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $t: typeof i18n.global.t
    $i18n: typeof i18n.global
    $root: {
      getter: (endpoint: string, params?: {}, config?: {}) => Promise<any>
      setter: (endpoint: string, data: any, config?: {}) => Promise<any>
      deleter: (endpoint: string, params: {}) => Promise<boolean>
      currencies: Currency[]
      countries: CountrySimple[]
    }
  }
}

createApp(App).component('vSelect', vSelect).use(i18n).use(router).mount('#app')
