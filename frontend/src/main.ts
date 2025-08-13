import axios from 'axios'
import qs from 'qs'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'

import 'vue-select/dist/vue-select.css'
import './vue-select.css'
import vSelect from './vue-select.js'

import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import './bootstrap.css'

import 'abrechnung-common/fonts/twemoji-flags.css'

import Formatter from 'abrechnung-common/formatter.js'
import { CountrySimple, Currency, Locale } from 'abrechnung-common/types.js'
import formatter from './formatter.js'
import i18n from './i18n.js'

// find windows user to give country flag web font on them
if (/windows/i.test(navigator.userAgent)) {
  const appEl = document.getElementById('app')
  if (appEl) {
    appEl.classList.add('win')
  }
}

// Light/Dark Mode switch
function updateBootstrapTheme() {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.setAttribute('data-bs-theme', isDarkMode ? 'dark' : 'light')
  // vueform looks for .dark class (https://vueform.com/docs/styles-and-layout#dark-mode)
  document.documentElement.setAttribute('class', isDarkMode ? 'dark' : '')
}
updateBootstrapTheme()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBootstrapTheme)

// globally config axios
axios.defaults.paramsSerializer = (params) => qs.stringify(params, { arrayFormat: 'repeat' })

declare module 'vue' {
  interface ComponentCustomProperties {
    $formatter: Formatter
    $vueform: { i18n: { locale: Locale } }
    $router: typeof router
    $root: {
      setLastCountry(country: CountrySimple): void
      setLastCurrency(currency: Currency): void
      isOffline: boolean
      alreadyInstalled: boolean
      mobile: boolean
    }
  }
}

export const app = createApp(App)
app.component('vSelect', vSelect)
app.use(i18n)
app.use(formatter)
app.use(router)
app.mount('#app')
