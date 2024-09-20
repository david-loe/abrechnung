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
            <div v-for="access of accesses" :key="access">
              <template v-if="access !== 'admin' && access.indexOf(':') === -1 && user.access[access]">
                <router-link :to="'/' + access" class="nav-link link-dark d-flex align-items-center">
                  <i v-for="icon of $root.settings.accessIcons[access]" :class="'fs-4 bi ' + icon"></i>
                  <span class="ms-1 d-none d-md-block">{{ $t('accesses.' + access) }}</span>
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
                    <option v-for="lang of locales" :key="lang" :value="lang" :title="$t('labels.' + lang)">
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
            style="z-index: 1100; max-width: 250px; max-height: 150px; overflow-y: hidden">
            <strong>
              <i v-if="alert.type == 'danger'" class="bi bi-x-octagon-fill"></i>
              <i v-if="alert.type == 'success'" class="bi bi-check-circle-fill"></i>
              {{ alert.title }}{{ alert.title && alert.message ? ': ' : '' }}
            </strong>
            {{ alert.message }}
            <div class="progress position-absolute top-0 end-0" style="height: 5px; width: 100%">
              <div
                :class="'progress-bar bg-' + alert.type"
                role="progressbar"
                id="alert-progress"
                aria-label="Danger example"
                :style="'animation-duration: ' + (alert.ttl ? alert.ttl : 5000) + 'ms;'"></div>
            </div>
            <button type="button" class="btn-close" @click="alerts.splice(index, 1)"></button>
          </div>
        </div>
      </div>
      <router-view :class="loadState === 'LOADED' ? 'd-block' : 'd-none'" />
    </div>

    <footer class="py-3 border-top">
      <div class="container">
        <div class="d-flex align-items-center lh-1">
          <i class="fs-3 bi bi-receipt"></i>

          <span class="ps-2 text-muted">
            © {{ new Date().getFullYear() }} {{ $t('headlines.title') }}
            <small v-if="settings.version"
              ><a
                class="text-decoration-none link-dark"
                target="_blank"
                :href="'https://github.com/david-loe/abrechnung/releases/tag/v' + settings.version"
                >v{{ settings.version }}</a
              ></small
            >
          </span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
import axios, { AxiosRequestConfig } from 'axios'
import { defineComponent } from 'vue'
import { log } from '../../common/logger.js'
import { getFlagEmoji } from '../../common/scripts.js'
import {
  CountrySimple,
  Currency,
  GETResponse,
  HealthInsurance,
  Locale,
  OrganisationSimple,
  ProjectSimple,
  SETResponse,
  Settings,
  User,
  accesses,
  locales
} from '../../common/types.js'

export interface Alert {
  type: 'danger' | 'success'
  title: string
  message?: string
  id?: number
  ttl?: number
}

export default defineComponent({
  data() {
    return {
      alerts: [] as Alert[],
      auth: false,
      user: {} as User,
      currencies: [] as Currency[],
      countries: [] as CountrySimple[],
      settings: {} as Settings,
      healthInsurances: [] as HealthInsurance[],
      organisations: [] as OrganisationSimple[],
      projects: [] as ProjectSimple[],
      specialLumpSums: {} as { [key: string]: string[] },
      users: [] as { name: User['name']; _id: string }[],
      loadState: 'UNLOADED' as 'UNLOADED' | 'LOADING' | 'LOADED',
      loadingPromise: null as Promise<void> | null,
      bp: { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 },
      locales,
      accesses
    }
  },
  components: {},
  methods: {
    async load() {
      if (this.loadState === 'UNLOADED') {
        this.loadState = 'LOADING'
        this.loadingPromise = Promise.allSettled([
          this.getter<User>('user'),
          this.getter<Currency[]>('currency'),
          this.getter<CountrySimple[]>('country'),
          this.getter<Settings>('settings'),
          this.getter<HealthInsurance[]>('healthInsurance'),
          this.getter<OrganisationSimple[]>('organisation'),
          this.getter<ProjectSimple[]>('project', {}, {}, false),
          this.getter<{ [key: string]: string[] }>('specialLumpSums'),
          this.getter<{ name: User['name']; _id: string }[]>('users', {}, {}, false)
        ]).then((result) => {
          this.user = result[0].status === 'fulfilled' ? (result[0].value.ok ? result[0].value.ok.data : ({} as User)) : ({} as User)
          this.currencies = result[1].status === 'fulfilled' ? (result[1].value.ok ? result[1].value.ok.data : []) : []
          this.countries = result[2].status === 'fulfilled' ? (result[2].value.ok ? result[2].value.ok.data : []) : []
          this.settings =
            result[3].status === 'fulfilled' ? (result[3].value.ok ? result[3].value.ok.data : ({} as Settings)) : ({} as Settings)
          this.healthInsurances = result[4].status === 'fulfilled' ? (result[4].value.ok ? result[4].value.ok.data : []) : []
          this.organisations = result[5].status === 'fulfilled' ? (result[5].value.ok ? result[5].value.ok.data : []) : []
          this.projects = result[6].status === 'fulfilled' ? (result[6].value.ok ? result[6].value.ok.data : []) : []
          this.specialLumpSums = result[7].status === 'fulfilled' ? (result[7].value.ok ? result[7].value.ok.data : {}) : {}
          this.users = result[8].status === 'fulfilled' ? (result[8].value.ok ? result[8].value.ok.data : []) : []

          log(this.$t('labels.user') + ':')
          log(this.user)
          if (this.user._id) {
            this.$i18n.locale = this.user.settings.language
            this.$vueform.i18n.locale = this.user.settings.language
            this.$formatter.setLocale(this.user.settings.language)
            this.auth = true
          }
          this.loadState = 'LOADED'
        })
        await this.loadingPromise
      } else if (this.loadState === 'LOADING') {
        await this.loadingPromise
      }
    },
    async logout() {
      try {
        const res = await axios.delete(import.meta.env.VITE_BACKEND_URL + '/auth/logout', {
          withCredentials: true
        })
        if (res.status === 204) {
          this.auth = false
          this.$router.push({ path: '/login' })
        }
      } catch (error: any) {
        this.addAlert({ message: error.response.data.message, title: 'ERROR', type: 'danger' })
        console.log(error.response.data)
      }
    },
    async getter<T>(endpoint: string, params: any = {}, config: any = {}, showAlert = true): Promise<{ ok?: GETResponse<T>; error?: any }> {
      try {
        const res = await axios.get(
          import.meta.env.VITE_BACKEND_URL + '/' + endpoint,
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
        if (showAlert) {
          if (error.response.status === 401) {
            this.$router.push({ path: '/login', query: { redirect: this.$route.path } })
          } else {
            console.log(error.response.data)
            this.addAlert({
              message: error.response.data.message,
              title: error.response.data.name ? this.$t(error.response.data.name) : 'ERROR',
              type: 'danger'
            })
          }
        }
        return { error: error.response.data }
      }
    },
    async setter<T>(endpoint: string, data: any, config: AxiosRequestConfig<any> = {}, showAlert = true): Promise<{ ok?: T; error?: any }> {
      try {
        const res = await axios.post(
          import.meta.env.VITE_BACKEND_URL + '/' + endpoint,
          data,
          Object.assign(
            {
              withCredentials: true
            },
            config
          )
        )
        if (showAlert) this.addAlert({ title: this.$t(res.data.message), type: 'success' })
        return { ok: (res.data as SETResponse<T>).result }
      } catch (error: any) {
        if (error.response) {
          if (error.response.status === 401) {
            this.$router.push({ path: '/login', query: { redirect: this.$route.path } })
          } else {
            console.log(error.response.data)
            this.addAlert({
              message: error.response.data.message,
              title: error.response.data.name ? this.$t(error.response.data.name) : 'ERROR',
              type: 'danger'
            })
          }
          return { error: error.response.data }
        } else {
          return { error: error }
        }
      }
    },
    async deleter(endpoint: string, params: { [key: string]: any; _id: string }, ask = true, showAlert = true): Promise<boolean | any> {
      if (ask) {
        if (!confirm(this.$t('alerts.areYouSureDelete'))) {
          return false
        }
      }
      try {
        const res = await axios.delete(import.meta.env.VITE_BACKEND_URL + '/' + endpoint, {
          params: params,
          withCredentials: true
        })
        if (res.status === 200) {
          if (showAlert) this.addAlert({ message: '', title: this.$t('alerts.successDeleting'), type: 'success' })
          if (res.data.result) {
            return res.data.result
          }
          return true
        }
      } catch (error: any) {
        if (error.response.status === 401) {
          this.$router.push({ path: '/login', query: { redirect: this.$route.path } })
        } else {
          console.log(error.response.data)
          this.addAlert({
            message: error.response.data.message,
            title: error.response.data.name ? this.$t(error.response.data.name) : 'ERROR',
            type: 'danger'
          })
        }
      }
      return false
    },
    addAlert(alert: Alert) {
      alert = Object.assign(alert, { id: Math.random() })
      this.alerts.push(alert)
      setTimeout(
        () => {
          const index = this.alerts.findIndex((al) => {
            return al.id === alert.id
          })
          if (index !== -1) {
            this.alerts.splice(index, 1)
          }
        },
        alert.ttl ? alert.ttl : 5000
      )
    },
    async pushUserSettings(settings: User['settings']) {
      this.$formatter.setLocale(this.$i18n.locale as Locale)
      settings.language = this.$i18n.locale as Locale
      this.$vueform.i18n.locale = this.$i18n.locale as Locale
      try {
        await axios.post(import.meta.env.VITE_BACKEND_URL + '/user/settings', settings, {
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
      this.setLast(currency, this.user.settings.lastCurrencies)
      this.pushUserSettings(this.user.settings)
    },
    setLastCountry(country: CountrySimple) {
      this.setLast(country, this.user.settings.lastCountries)
      this.pushUserSettings(this.user.settings)
    },
    setLast<T>(item: T, list: T[], limit = 3) {
      const index = list.indexOf(item)
      if (index !== -1) {
        list.splice(index, 1)
      }
      const length = list.unshift(item)
      if (length > limit) {
        list.pop()
      }
    },
    getFlagEmoji
  },
  created() {
    document.title = this.$t('headlines.title') + ' ' + this.$t('headlines.emoji')
  }
})
</script>

<style>
@font-face {
  font-family: 'Twemoji Country Flags';
  unicode-range: U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067, U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F;
  src: url('../../common/fonts/TwemojiCountryFlags.woff2');
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
  /* z-index: -999; */
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
  animation-timing-function: linear;
}

.router-link-active {
  font-weight: bold !important;
}
</style>
