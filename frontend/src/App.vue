<template>
  <div>
    <OfflineBanner v-if="isOffline"></OfflineBanner>
    <ModalComponent v-if="APP_DATA" header="API Key" ref="modalComp" @afterClose=";($refs.apiKeyForm as any).resetForm()">
      <ApiKeyForm :user="APP_DATA.user" endpoint="user/httpBearer" @cancel=";($refs.modalComp as any).hideModal()" ref="apiKeyForm">
      </ApiKeyForm>
    </ModalComponent>
    <nav class="navbar navbar-expand-lg border-bottom py-1">
      <div class="container d-flex" id="navBarContent">
        <a href="/" class="navbar-brand link-body-emphasis d-flex align-items-center py-0">
          <i class="fs-3 bi bi-receipt"></i>
          <span class="fs-4 ms-1">{{ $t('headlines.title') }}</span>
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse justify-content-end" id="navbarSupportedContent">
          <template v-if="APP_DATA">
            <ul class="navbar-nav" style="flex-wrap: wrap">
              <template v-for="access of accesses" :key="access">
                <template v-if="access.indexOf(':') === -1 && APP_DATA.user.access[access]">
                  <li class="nav-item d-flex align-items-center">
                    <router-link :to="'/' + access" class="nav-link link-body-emphasis d-flex align-items-center">
                      <i v-for="icon of APP_DATA.displaySettings.accessIcons[access]" :class="'bi bi-' + icon"></i>
                      <span class="ms-1">{{ $t('accesses.' + access) }}</span>
                    </router-link>
                  </li>
                </template>
              </template>
              <li class="nav-item dropdown">
                <a
                  class="nav-link link-body-emphasis d-flex align-items-center dropdown-toggle"
                  data-bs-toggle="dropdown"
                  href="#"
                  role="button">
                  <i class="fs-4 bi bi-person-circle"></i>
                  <span class="ms-1">{{ APP_DATA.user.name.givenName }}</span>
                </a>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li>
                    <select class="form-select mx-auto" v-model="$i18n.locale" style="max-width: 68px" @change="updateLanguage()">
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
                  <template v-if="mobile && !alreadyInstalled && !isOffline">
                    <li>
                      <hr class="dropdown-divider" />
                    </li>
                    <li>
                      <button @click="showInstallBanner" class="d-flex align-items-center dropdown-item">
                        <i class="fs-4 bi bi-box-arrow-down"></i>
                        <span class="ms-1">{{ $t('labels.installApp') }}</span>
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
              </li>
            </ul>
          </template>
          <div v-else>
            <router-link to="/login" class="nav-link link-body-emphasis d-flex align-items-center">
              <i class="fs-4 bi bi-box-arrow-in-right"></i>
              <span class="ms-1">{{ $t('headlines.login') }}</span>
            </router-link>
          </div>
        </div>
      </div>
    </nav>

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
              <i v-if="alert.type === 'danger'" class="bi bi-x-octagon-fill"></i>
              <i v-else-if="alert.type === 'success'" class="bi bi-check-circle-fill"></i>
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

      <router-view :class="loadState === 'LOADED' ? 'd-block' : 'd-none'" v-slot="{ Component }">
        <template v-if="Component">
          <Suspense>
            <template #default>
              <component :is="Component"></component>
            </template>
            <template #fallback> </template>
          </Suspense>
        </template>
      </router-view>
    </div>

    <footer class="py-3 border-top">
      <div class="container">
        <div class="d-flex align-items-center lh-1">
          <i class="fs-3 bi bi-receipt"></i>

          <span class="ps-2 text-secondary">
            © {{ new Date().getFullYear() }} abrechnung
            <small v-if="APP_DATA?.settings.version"
              ><a
                class="text-decoration-none link-secondary"
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
import { defineComponent } from 'vue'
import { getFlagEmoji } from '@/../../common/scripts.js'
import { accesses, CountrySimple, Currency, Locale, locales, User } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ApiKeyForm from '@/components/elements/ApiKeyForm.vue'
import Installation from '@/components/elements/Installation.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import OfflineBanner from '@/components/elements/OfflineBanner.vue'
import { clearingDB, subscribeToPush } from '@/helper.js'

export default defineComponent({
  data() {
    return {
      alerts: API.alerts,
      APP_DATA: APP_LOADER.data,
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
      const success = await API.deleter('auth/logout', {}, false, { success: false, error: true })
      if (success) {
        this.APP_DATA = null
        clearingDB()
        this.$router.push({ path: '/login' })
      }
    },
    async updateLanguage() {
      this.$vueform.i18n.locale = this.$i18n.locale as Locale
      this.$formatter.setLocale(this.$i18n.locale as Locale)
      if (this.APP_DATA) {
        this.APP_DATA.user.settings.language = this.$i18n.locale as Locale
        this.APP_DATA.user.settings.hasUserSetLanguage = true
        await API.setter('user/settings', { language: this.$i18n.locale, hasUserSetLanguage: true } as User['settings'], {}, false)
      }
    },
    setLastCurrency(currency: Currency) {
      if (this.APP_DATA) {
        this.setLast(currency, this.APP_DATA.user.settings.lastCurrencies)
        API.setter('user/settings', { lastCurrencies: this.APP_DATA.user.settings.lastCurrencies.map((c) => c._id) }, {}, false)
      }
    },
    setLastCountry(country: CountrySimple) {
      if (this.APP_DATA) {
        this.setLast(country, this.APP_DATA.user.settings.lastCountries)
        API.setter('user/settings', { lastCountries: this.APP_DATA.user.settings.lastCountries.map((c) => c._id) }, {}, false)
      }
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
    if (!this.isOffline) {
      subscribeToPush()
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
  margin-bottom: 60px !important;
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
