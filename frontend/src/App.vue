<template>
  <div>
    <OfflineBanner v-if="isOffline"></OfflineBanner>
    <ModalComponent header="API Key" ref="modalComp" @close=";($refs.apiKeyForm as any).resetForm()">
      <ApiKeyForm :user="user" endpoint="user/httpBearer" @cancel=";($refs.modalComp as any).hideModal()" ref="apiKeyForm"></ApiKeyForm>
    </ModalComponent>
    <header class="mb-3 border-bottom">
      <div class="container">
        <div class="d-flex flex-row align-items-center nav">
          <div class="me-auto">
            <a href="/" class="nav-link link-body-emphasis d-flex align-items-center">
              <i class="fs-1 bi bi-receipt"></i>
              <span class="fs-4 ms-2 d-none d-md-block">{{ $t('headlines.title') }}</span>
            </a>
          </div>
          <template v-if="auth">
            <div v-for="access of accesses" :key="access">
              <template v-if="access !== 'admin' && access.indexOf(':') === -1 && user.access[access]">
                <router-link :to="'/' + access" class="nav-link link-body-emphasis d-flex align-items-center">
                  <i v-for="icon of $root.settings.accessIcons[access]" :class="'fs-4 bi ' + icon"></i>
                  <span class="ms-1 d-none d-md-block">{{ $t('accesses.' + access) }}</span>
                </router-link>
              </template>
            </div>
            <div class="dropdown">
              <a
                class="nav-link link-body-emphasis d-flex align-items-center dropdown-toggle"
                data-bs-toggle="dropdown"
                href="#"
                role="button">
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
                <li>
                  <hr class="dropdown-divider" />
                </li>
                <li>
                  <button @click=";($refs.modalComp as any).modal.show()" class="d-flex align-items-center dropdown-item">
                    <i class="fs-4 bi bi-key"></i>
                    <span class="ms-1">API Key</span>
                  </button>
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
                <template v-if="mobile && !alreadyInstalled && !isOffline">
                  <li>
                    <hr class="dropdown-divider" />
                  </li>
                  <li>
                    <button @click="showInstallBanner" class="d-flex align-items-center dropdown-item">
                      <i class="fs-4 bi bi-box-arrow-down"></i>
                      <span class="ms-1">{{ $t('headlines.installApp') }}</span>
                    </button>
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
            <router-link to="/login" class="nav-link link-body-emphasis d-flex align-items-center">
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
                class="text-decoration-none link-body-emphasis"
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
  <Installation ref="InstallBanner" v-if="$root.loadState === 'LOADED' && auth && !isOffline"></Installation>
</template>

<script lang="ts">
import axios from 'axios'
import { defineComponent } from 'vue'
import { loadLocales } from '../../common/locales/load.js'
import { log } from '../../common/logger.js'
import { getFlagEmoji } from '../../common/scripts.js'
import {
  accesses,
  CountrySimple,
  Currency,
  DisplaySettings,
  HealthInsurance,
  Locale,
  locales,
  OrganisationSimple,
  ProjectSimple,
  Settings,
  User
} from '../../common/types.js'
import API from './api.js'
import ApiKeyForm from './components/elements/ApiKeyForm.vue'
import Installation from './components/elements/Installation.vue'
import ModalComponent from './components/elements/ModalComponent.vue'
import OfflineBanner from './components/elements/OfflineBanner.vue'
import { clearingDB, subscribeToPush } from './helper.js'
import i18n from './i18n.js'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}
export default defineComponent({
  data() {
    return {
      alerts: API.alerts,
      auth: false,
      user: {} as User,
      currencies: [] as Currency[],
      countries: [] as CountrySimple[],
      settings: {} as Settings,
      displaySettings: {} as DisplaySettings,
      healthInsurances: [] as HealthInsurance[],
      organisations: [] as OrganisationSimple[],
      projects: [] as ProjectSimple[],
      specialLumpSums: {} as { [key: string]: string[] },
      users: [] as { name: User['name']; _id: string }[],
      loadState: 'UNLOADED' as 'UNLOADED' | 'LOADING' | 'LOADED',
      loadingPromise: null as Promise<void> | null,
      locales,
      accesses,
      isOffline: false as boolean,
      alreadyInstalled: false as boolean,
      mobile: false as boolean,
      promptInstallEvent: undefined as BeforeInstallPromptEvent | undefined
    }
  },
  components: { OfflineBanner, Installation, ModalComponent, ApiKeyForm },
  methods: {
    async load(withoutAuth = false) {
      if (this.loadState === 'UNLOADED') {
        this.loadState = 'LOADING'
        const displayPromise = Promise.allSettled([API.getter<DisplaySettings>('displaySettings')]).then((result) => {
          this.displaySettings =
            result[0].status === 'fulfilled'
              ? result[0].value.ok
                ? result[0].value.ok.data
                : ({} as DisplaySettings)
              : ({} as DisplaySettings)
          const messages = loadLocales(this.displaySettings.locale.overwrite)
          for (const locale in messages) {
            i18n.global.setLocaleMessage(locale, messages[locale as Locale])
          }
          this.updateLocale(this.displaySettings.locale.default)
          this.$i18n.fallbackLocale = this.displaySettings.locale.fallback
          document.title = this.$t('headlines.title') + ' ' + this.$t('headlines.emoji')
        })
        if (withoutAuth) {
          this.loadingPromise = displayPromise.then(() => {
            this.loadState = 'LOADED'
          })
        } else {
          this.loadingPromise = Promise.allSettled([
            API.getter<User>('user'),
            API.getter<Currency[]>('currency'),
            API.getter<CountrySimple[]>('country'),
            API.getter<Settings>('settings'),
            API.getter<HealthInsurance[]>('healthInsurance'),
            API.getter<OrganisationSimple[]>('organisation'),
            API.getter<ProjectSimple[]>('project', {}, {}, false),
            API.getter<{ [key: string]: string[] }>('specialLumpSums'),
            API.getter<{ name: User['name']; _id: string }[]>('users', {}, {}, false),
            displayPromise
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
              this.updateLocale(this.user.settings.language)
              this.auth = true
            }
            this.isOffline = !navigator.onLine
            this.mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
            this.alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches
            this.loadState = 'LOADED'
          })
        }
        await this.loadingPromise
        //subscribing to push notifications if network connection avaiable
        if (!this.isOffline) {
          await subscribeToPush()
        }
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
          clearingDB()
          this.$router.push({ path: '/login' })
        }
      } catch (error: any) {
        API.addAlert({ message: error.response.data.message, title: 'ERROR', type: 'danger' })
        console.log(error.response.data)
      }
    },
    async pushUserSettings(settings: User['settings']) {
      this.updateLocale(this.$i18n.locale as Locale, false)
      settings.language = this.$i18n.locale as Locale
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
    updateLocale(locale: Locale, updateI18n = true) {
      if (updateI18n) {
        this.$i18n.locale = locale
      }
      this.$vueform.i18n.locale = locale
      this.$formatter.setLocale(locale)
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
    getFlagEmoji,
    updateConnectionStatus() {
      this.isOffline = !window.navigator.onLine
    },
    showInstallBanner() {
      if (this.$refs.InstallBanner as typeof Installation) {
        ;(this.$refs.InstallBanner as typeof Installation).showBanner()
      }
    }
  },
  mounted() {
    window.addEventListener('online', this.updateConnectionStatus)
    window.addEventListener('offline', this.updateConnectionStatus)
  },
  created() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault()
      this.promptInstallEvent = event as BeforeInstallPromptEvent
    })
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
