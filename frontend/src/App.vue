<template>
  <div>
    <OfflineBanner v-if="isOffline"></OfflineBanner>
    <ModalComponent v-if="APP_DATA" header="API Key" ref="modalComp" @close=";($refs.apiKeyForm as any).resetForm()">
      <ApiKeyForm
        :user="APP_DATA.user"
        endpoint="user/httpBearer"
        @cancel=";($refs.modalComp as any).hideModal()"
        ref="apiKeyForm"></ApiKeyForm>
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
          <template v-if="APP_DATA">
            <div v-for="access of accesses" :key="access">
              <template v-if="access !== 'admin' && access.indexOf(':') === -1 && APP_DATA.user.access[access]">
                <router-link :to="'/' + access" class="nav-link link-body-emphasis d-flex align-items-center">
                  <i v-for="icon of APP_DATA.settings.accessIcons[access]" :class="'fs-4 bi ' + icon"></i>
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
                <span class="ms-1 d-none d-md-block">{{ APP_DATA.user.name.givenName }}</span>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <li>
                  <select
                    class="form-select mx-auto"
                    v-model="$i18n.locale"
                    style="max-width: 68px"
                    @change="pushUserSettings(APP_DATA.user.settings)">
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
                <template v-if="APP_DATA?.user.access.admin">
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
            <small v-if="APP_DATA?.settings.version"
              ><a
                class="text-decoration-none link-body-emphasis"
                target="_blank"
                :href="'https://github.com/david-loe/abrechnung/releases/tag/v' + APP_DATA.settings.version"
                >v{{ APP_DATA.settings.version }}</a
              ></small
            >
          </span>
        </div>
      </div>
    </footer>
  </div>
  <Installation ref="InstallBanner" v-if="loadState === 'LOADED' && APP_DATA?.user && !isOffline && !alreadyInstalled"></Installation>
</template>

<script lang="ts">
import axios from 'axios'
import { defineComponent } from 'vue'
import { getFlagEmoji } from '../../common/scripts.js'
import { accesses, CountrySimple, Currency, Locale, locales, User } from '../../common/types.js'
import API from './api.js'
import APP_LOADER, { APP_DATA as IAPP_DATA } from './appData.js'
import ApiKeyForm from './components/elements/ApiKeyForm.vue'
import Installation from './components/elements/Installation.vue'
import ModalComponent from './components/elements/ModalComponent.vue'
import OfflineBanner from './components/elements/OfflineBanner.vue'
import { clearingDB, subscribeToPush } from './helper.js'
import { logger } from './logger.js'
import { auth } from './router.js'

export default defineComponent({
  data() {
    return {
      alerts: API.alerts,
      APP_DATA: null as IAPP_DATA | null,
      loadState: APP_LOADER.state,
      locales,
      accesses,
      isOffline: !navigator.onLine,
      alreadyInstalled: window.matchMedia('(display-mode: standalone)').matches,
      mobile: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    }
  },
  components: { OfflineBanner, Installation, ModalComponent, ApiKeyForm },
  methods: {
    async logout() {
      try {
        const res = await axios.delete(import.meta.env.VITE_BACKEND_URL + '/auth/logout', {
          withCredentials: true
        })
        if (res.status === 204) {
          this.APP_DATA = null
          clearingDB()
          this.$router.push({ path: '/login' })
        }
      } catch (error: any) {
        API.addAlert({ message: error.response.data.message, title: 'ERROR', type: 'danger' })
        logger.error(error.response.data)
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
          logger.error(error.response.data)
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
      this.setLast(currency, this.APP_DATA!.user.settings.lastCurrencies)
      this.pushUserSettings(this.APP_DATA!.user.settings)
    },
    setLastCountry(country: CountrySimple) {
      this.setLast(country, this.APP_DATA!.user.settings.lastCountries)
      this.pushUserSettings(this.APP_DATA!.user.settings)
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
    },
    async load(reload = false) {
      this.APP_DATA = await APP_LOADER.loadData(reload)
      this.updateLocale(this.APP_DATA.displaySettings.locale.default)
    }
  },
  mounted() {
    window.addEventListener('online', this.updateConnectionStatus)
    window.addEventListener('offline', this.updateConnectionStatus)
    if (!this.isOffline) {
      subscribeToPush()
    }
  },
  async created() {
    // Nicht ideal da auth dann doppelt gecheckt wird..
    if (await auth()) {
      await this.load()
    }
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
