<template>
  <div>
    <header class="mb-3 border-bottom bg-white bg-opacity-25">
      <div class="container">
        <div class="d-flex flex-row align-items-center nav">
          <div class="me-auto">
            <a href="/" class="nav-link link-dark d-flex align-items-center">
              <i class="fs-1 bi bi-receipt"></i>
              <span class="fs-4 ms-2 d-none d-md-block">{{ $t('headlines.title') }}</span>
            </a>
          </div>
          <template v-if="auth">
            <div>
              <router-link to="/" class="nav-link link-dark d-flex align-items-center">
                <i class="fs-4 bi bi-card-list"></i>
                <span class="ms-1 d-none d-md-block">{{ $t('headlines.home') }}</span>
              </router-link>
            </div>
            <div v-for="access of accesses" :key="access">
              <template v-if="access !== 'admin' && user.access[access]">
                <router-link :to="'/' + access" class="nav-link link-dark d-flex align-items-center">
                  <i v-for="icon of $root.settings.accessIcons[access]" :class="'fs-4 bi ' + icon"></i>
                  <span class="ms-1 d-none d-md-block">{{ $t('labels.' + access) }}</span>
                </router-link>
              </template>
            </div>
            <div class="dropdown">
              <a class="nav-link link-dark d-flex align-items-center dropdown-toggle" data-bs-toggle="dropdown" href="#" role="button">
                <i class="fs-4 bi bi-person-circle"></i>
                <span class="ms-1 d-none d-md-block">{{ user.name.givenName }}</span>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <select
                    class="form-select mx-auto"
                    v-model="$i18n.locale"
                    style="max-width: 68px"
                    @change="pushUserSettings(user.settings)">
                    <option v-for="lang of locales" :key="lang" :value="lang" :title="$t('languages.' + lang)">
                      {{ lang !== 'en' ? getFlagEmoji(lang) : '🇬🇧' }}
                    </option>
                  </select>
                </li>
                <template v-if="user.access.admin">
                  <li>
                    <hr class="dropdown-divider" />
                  </li>
                  <li>
                    <router-link to="/settings" class="d-flex align-items-center dropdown-item">
                      <i class="fs-4 bi bi-gear"></i>
                      <span class="ms-1">{{ $t('headlines.settings') }}</span>
                    </router-link>
                  </li>
                </template>

                <li>
                  <hr class="dropdown-divider" />
                </li>
                <li>
                  <a class="d-flex align-items-center dropdown-item" href="#" @click="logout">
                    <i class="fs-4 bi bi-box-arrow-left"></i>
                    <span class="ms-1">{{ $t('headlines.logout') }}</span>
                  </a>
                </li>
              </ul>
            </div>
          </template>
          <div v-else>
            <router-link to="/login" class="nav-link link-dark d-flex align-items-center">
              <i class="fs-4 bi bi-box-arrow-in-right"></i>
              <span class="ms-1 d-none d-md-block">{{ $t('headlines.login') }}</span>
            </router-link>
          </div>
        </div>
      </div>
    </header>

    <div v-if="loadState !== 'LOADED'" class="position-absolute top-50 start-50 translate-middle">
      <div class="spinner-grow me-3" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <div class="spinner-grow me-3" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <div class="spinner-grow" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
    <div class="position-relative">
      <div class="position-absolute top-0 end-0" style="height: 100%">
        <div class="position-sticky top-0 pt-2 pe-2" style="z-index: 1100">
          <div
            v-for="(alert, index) of alerts"
            :key="alert.id"
            :class="'alert alert-' + alert.type + ' alert-dismissible ms-auto'"
            role="alert"
            style="z-index: 1100; max-width: 250px">
            <strong>
              <i v-if="alert.type == 'danger'" class="bi bi-x-octagon-fill"></i>
              <i v-if="alert.type == 'success'" class="bi bi-check-circle-fill"></i>
              {{ alert.title }}{{ alert.title && alert.message ? ': ' : '' }}
            </strong>
            {{ alert.message }}
            <div class="progress position-absolute top-0 end-0" style="height: 5px; width: 100%">
              <div :class="'progress-bar bg-' + alert.type" role="progressbar" id="alert-progress" aria-label="Danger example"></div>
            </div>
            <button type="button" class="btn-close" @click="alerts.splice(index, 1)"></button>
          </div>
        </div>
      </div>
      <router-view :class="loadState === 'LOADED' ? 'd-block' : 'd-none'" />
    </div>
    <div class="modal fade" id="userSettingsModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ $t('headlines.settings') }}</h5>
          </div>
          <div v-if="user.settings" class="modal-body">
            <UserSettingsForm
              :settings="user.settings"
              :showCancel="false"
              @edit="(settings) => pushUserSettings(settings).then(() => checkUserSettings(settings))" />
          </div>
        </div>
      </div>
    </div>

    <footer class="py-3 border-top">
      <div class="container">
        <div class="d-flex align-items-center">
          <a href="/" class="text-decoration-none link-dark lh-1">
            <i class="fs-3 bi bi-receipt"></i>
          </a>
          <span class="ps-2 text-muted">
            © {{ new Date().getFullYear() }} {{ $t('headlines.title') }} <small v-if="settings.version">v{{ settings.version }}</small>
          </span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
import axios from 'axios'
import { defineComponent } from 'vue'
import { Modal } from 'bootstrap'
import {
  CountrySimple,
  Currency,
  Locale,
  User,
  accesses,
  locales,
  Settings,
  HealthInsurance,
  OrganisationSimple,
  GETResponse,
  SETResponse
} from '../../common/types.js'
import { log } from '../../common/logger.js'
import TwemojiCountryFlags from '../../common/fonts/TwemojiCountryFlags.woff2'
import UserSettingsForm from './components/settings/forms/UserSettingsForm.vue'
import { getFlagEmoji } from '../../common/scripts.js'

export interface Alert {
  type: 'danger' | 'success'
  title: string
  message?: string
  id?: number
}

export default defineComponent({
  data() {
    return {
      userSettingsModal: undefined as Modal | undefined,
      alerts: [] as Alert[],
      auth: false,
      user: {} as User,
      currencies: [] as Currency[],
      countries: [] as CountrySimple[],
      settings: {} as Settings,
      healthInsurances: [] as HealthInsurance[],
      organisations: [] as OrganisationSimple[],
      loadState: 'UNLOADED' as 'UNLOADED' | 'LOADING' | 'LOADED',
      loadingPromise: null as Promise<void> | null,
      bp: { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 },
      locales,
      accesses,
      TwemojiCountryFlags
    }
  },
  components: { UserSettingsForm },
  methods: {
    async load() {
      if (this.loadState === 'UNLOADED') {
        this.loadState = 'LOADING'
        this.loadingPromise = Promise.allSettled([
          this.getter<User>('user'),
          this.getter<Currency[]>('currency'),
          this.getter<CountrySimple[]>('country'),
          this.getter<Settings[]>('settings'),
          this.getter<HealthInsurance[]>('healthInsurance'),
          this.getter<OrganisationSimple[]>('organisation')
        ]).then((result) => {
          this.user = result[0].status === 'fulfilled' ? (result[0].value.ok ? result[0].value.ok.data : ({} as User)) : ({} as User)
          log(this.$t('labels.user') + ':')
          log(this.user)
          if (this.user._id) {
            this.$i18n.locale = this.user.settings.language
            this.auth = true
          }
          this.currencies = result[1].status === 'fulfilled' ? (result[1].value.ok ? result[1].value.ok.data : []) : []
          this.countries = result[2].status === 'fulfilled' ? (result[2].value.ok ? result[2].value.ok.data : []) : []
          this.settings =
            result[3].status === 'fulfilled' ? (result[3].value.ok ? result[3].value.ok.data[0] : ({} as Settings)) : ({} as Settings)
          this.healthInsurances = result[4].status === 'fulfilled' ? (result[4].value.ok ? result[4].value.ok.data : []) : []
          this.organisations = result[5].status === 'fulfilled' ? (result[5].value.ok ? result[5].value.ok.data : []) : []
          this.checkUserSettings(this.user.settings)
          this.loadState = 'LOADED'
        })
        await this.loadingPromise
      } else if (this.loadState === 'LOADING') {
        await this.loadingPromise
      }
    },
    async logout() {
      try {
        const res = await axios.delete(import.meta.env.VITE_BACKEND_URL + '/api/logout', {
          withCredentials: true
        })
        if (res.status === 200) {
          this.auth = false
          this.$router.push({ path: '/login' })
        }
      } catch (error: any) {
        this.addAlert({ message: error.response.data.message, title: 'ERROR', type: 'danger' })
        console.log(error.response.data)
      }
    },
    async getter<T>(endpoint: string, params: any = {}, config: any = {}): Promise<{ ok?: GETResponse<T>; error?: any }> {
      try {
        const res = await axios.get(
          import.meta.env.VITE_BACKEND_URL + '/api/' + endpoint,
          Object.assign(
            {
              params: params,
              withCredentials: true
            },
            config
          )
        )
        if (config.responseType === 'blob') {
          return { ok: { data: res.data, meta: { count: 1, page: 1, limit: 1, countPages: 1 } } }
        }
        return { ok: res.data }
      } catch (error: any) {
        if (error.response.status === 401) {
          this.$router.push({ path: '/login', query: { redirect: this.$route.path } })
        } else {
          console.log(error.response.data)
          this.addAlert({ message: error.response.data.message, title: 'ERROR', type: 'danger' })
        }
        return { error: error }
      }
    },
    async setter<T>(endpoint: string, data: any, config = {}, showAlert = true): Promise<{ ok?: T; error?: any }> {
      try {
        const res = await axios.post(
          import.meta.env.VITE_BACKEND_URL + '/api/' + endpoint,
          data,
          Object.assign(
            {
              withCredentials: true
            },
            config
          )
        )
        if (showAlert) this.addAlert({ message: '', title: (res.data as SETResponse<T>).message, type: 'success' })
        return { ok: (res.data as SETResponse<T>).result }
      } catch (error: any) {
        if (error.response.status === 401) {
          this.$router.push({ path: '/login', query: { redirect: this.$route.path } })
        } else {
          console.log(error.response.data)
          this.addAlert({ message: error.response.data.message, title: 'ERROR', type: 'danger' })
        }
        return { error }
      }
    },
    async deleter(endpoint: string, params: { [key: string]: any; id: string }, ask = true, showAlert = true): Promise<boolean> {
      if (ask) {
        if (!confirm(this.$t('alerts.areYouSureDelete'))) {
          return false
        }
      }
      try {
        const res = await axios.delete(import.meta.env.VITE_BACKEND_URL + '/api/' + endpoint, {
          params: params,
          withCredentials: true
        })
        if (res.status === 200) {
          if (showAlert) this.addAlert({ message: '', title: res.data.message, type: 'success' })
          return true
        }
      } catch (error: any) {
        if (error.response.status === 401) {
          this.$router.push({ path: '/login', query: { redirect: this.$route.path } })
        } else {
          console.log(error.response.data)
          this.addAlert({ message: error.response.data.message, title: 'ERROR', type: 'danger' })
        }
      }
      return false
    },
    addAlert(alert: Alert) {
      alert = Object.assign(alert, { id: Math.random() })
      this.alerts.push(alert)
      setTimeout(() => {
        const index = this.alerts.findIndex((al) => {
          return al.id === alert.id
        })
        if (index !== -1) {
          this.alerts.splice(index, 1)
        }
      }, 5000)
    },
    async pushUserSettings(settings: User['settings']) {
      settings.language = this.$i18n.locale as Locale
      try {
        await axios.post(import.meta.env.VITE_BACKEND_URL + '/api/user/settings', settings, {
          withCredentials: true
        })
      } catch (error: any) {
        if (error.response.status === 401) {
          this.$router.push('login')
        } else {
          console.log(error.response.data)
        }
      }
    },
    setLastCurrency(currency: Currency) {
      const index = this.user.settings.lastCurrencies.indexOf(currency)
      if (index !== -1) {
        this.user.settings.lastCurrencies.splice(index, 1)
      }
      const length = this.user.settings.lastCurrencies.unshift(currency)
      if (length > 3) {
        this.user.settings.lastCurrencies.pop()
      }
      this.pushUserSettings(this.user.settings)
    },
    setLastCountry(country: CountrySimple) {
      const index = this.user.settings.lastCountries.indexOf(country)
      if (index !== -1) {
        this.user.settings.lastCountries.splice(index, 1)
      }
      const length = this.user.settings.lastCountries.unshift(country)
      if (length > 3) {
        this.user.settings.lastCountries.pop()
      }
      this.pushUserSettings(this.user.settings)
    },
    checkUserSettings(settings: User['settings']) {
      if (!settings.insurance || (this.organisations.length > 0 && !settings.organisation)) {
        if (this.userSettingsModal) this.userSettingsModal.show()
      } else {
        if (this.userSettingsModal) this.userSettingsModal.hide()
      }
    },
    getFlagEmoji
  },
  mounted() {
    const modalEL = document.getElementById('userSettingsModal')
    if (modalEL) {
      this.userSettingsModal = new Modal(modalEL, {})
    }
  }
})
</script>

<style>
@font-face {
  font-family: 'Twemoji Country Flags';
  unicode-range: U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067, U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F;
  src: v-bind('TwemojiCountryFlags') format('woff2');
}

body {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.win {
  font-family: 'Twemoji Country Flags', Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

html {
  position: relative;
  min-height: 100%;
}

body {
  margin-bottom: 75px !important;
  /* Margin bottom by footer height */
}

footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 60px;
  /* Set the fixed height of the footer here */
  z-index: -999;
}

@keyframes run {
  0% {
    width: 0%;
  }

  100% {
    width: 100%;
  }
}

#alert-progress {
  animation-name: run;
  animation-duration: 5s;
  animation-timing-function: linear;
}

.router-link-active {
  font-weight: bold !important;
}
</style>
