import { createApp } from 'vue'
import App, { Alert } from './App.vue'
import router from './router.js'

import vSelect from './vue-select.js'
import 'vue-select/dist/vue-select.css'
import './vue-select.css'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'

import i18n from './i18n.js'
import { CountrySimple, Currency, GETResponse, HealthInsurance, OrganisationSimple, Settings, User } from '../../common/types.js'

// find windows user to give country flag web font on them
if (/windows/i.test(navigator.userAgent)) {
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.classList.add('win')
  }
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $router: typeof router
    $root: {
      getter: <T>(endpoint: string, params?: any, config?: any) => Promise<{ ok?: GETResponse<T>; error?: any }>
      setter: <T>(endpoint: string, data: any, config?: {}, showAlert?: Boolean) => Promise<{ ok?: T; error?: any }>
      deleter: (endpoint: string, params: { [key: string]: any; id: string }, ask?: Boolean, showAlert?: Boolean) => Promise<boolean>
      addAlert(alert: Alert): void
      setLastCountry(country: CountrySimple): void
      setLastCurrency(currency: Currency): void
      load: () => Promise<void>
      pushUserSettings: (settings: User['settings']) => Promise<void>
      loadState: 'UNLOADED' | 'LOADING' | 'LOADED'
      currencies: Currency[]
      countries: CountrySimple[]
      user: User
      settings: Settings
      healthInsurances: HealthInsurance[]
      organisations: OrganisationSimple[]
    }
  }
}

createApp(App).component('vSelect', vSelect).use(i18n).use(router).mount('#app')
