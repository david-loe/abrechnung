import axios from 'axios'
import qs from 'qs'

import 'vue-select/dist/vue-select.css'
import './vue-select.css'

import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import './bootstrap.css'

import 'abrechnung-common/fonts/twemoji-flags.css'
import 'abrechnung-common/fonts/inter.css'

import './fonts.css'

import { Locale } from 'abrechnung-common/types.js'

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
    $vueform: { i18n: { locale: Locale } }
  }
}
