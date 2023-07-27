import { createApp } from 'vue'
import App from './App.vue'
import { Alert } from './App.vue'
import router from './router'

import vSelect from './vue-select'
import 'vue-select/dist/vue-select.css'
import './vue-select.css'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'

import i18n from './i18n'
import { CountrySimple, Currency, User } from '../../common/types'

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
    $router: typeof router
    $root: {
      getter: (endpoint: string, params?: {}, config?: {}) => Promise<any>
      setter: (endpoint: string, data: any, config?: {}) => Promise<any>
      deleter: (endpoint: string, params: {}) => Promise<boolean>
      addAlert(alert: Alert): void
      setLastCountry(country: CountrySimple): void
      setLastCurrency(currency: Currency): void
      load: () => Promise<void>
      loadState: 'UNLOADED' | 'LOADING' | 'LOADED'
      currencies: Currency[]
      countries: CountrySimple[]
      user: User
    }
  }
}

createApp(App).component('vSelect', vSelect).use(i18n).use(router).mount('#app')
