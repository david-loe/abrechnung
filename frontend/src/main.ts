import axios, { AxiosRequestConfig } from 'axios'
import qs from 'qs'
import { createApp } from 'vue'
import App, { Alert } from './App.vue'
import router from './router.js'

import 'vue-select/dist/vue-select.css'
import './vue-select.css'
import vSelect from './vue-select.js'

// @ts-ignore
import Vue3EasyDataTable from 'vue3-easy-data-table'
import 'vue3-easy-data-table/dist/style.css'
import './vue3-easy-data-table.css'

import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'bootstrap/dist/css/bootstrap.min.css'

import { CountrySimple, Currency, GETResponse, HealthInsurance, ProjectSimple, Settings, User } from '../../common/types.js'
import i18n from './i18n.js'

// find windows user to give country flag web font on them
if (/windows/i.test(navigator.userAgent)) {
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.classList.add('win')
  }
}

// globally config axios
axios.defaults.paramsSerializer = (params) => qs.stringify(params, { arrayFormat: 'repeat' })

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $router: typeof router
    $root: {
      getter: <T>(endpoint: string, params?: any, config?: any) => Promise<{ ok?: GETResponse<T>; error?: any }>
      setter: <T>(endpoint: string, data: any, config?: AxiosRequestConfig<any>, showAlert?: Boolean) => Promise<{ ok?: T; error?: any }>
      deleter: (endpoint: string, params: { [key: string]: any; _id: string }, ask?: Boolean, showAlert?: Boolean) => Promise<boolean | any>
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
      projects: ProjectSimple[]
      specialLumpSums: { [key: string]: string[] }
      users: { name: User['name']; _id: string }[]
    }
  }
}

createApp(App).component('vSelect', vSelect).component('EasyDataTable', Vue3EasyDataTable).use(i18n).use(router).mount('#app')
