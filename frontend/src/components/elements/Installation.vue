<template>
  <div
    id="installBanner"
    v-if="showInstallationBanner && $root.mobile"
    style="
      width: 100%;
      position: fixed;
      height: 33vh;
      left: 0px;
      bottom: 0px;
      z-index: 4000;
      display: block;
      background-color: rgb(240, 240, 240, 1);
      justify-content: center;
    ">
    <div class="container-lg p-3">
      <div style="display: flex; justify-content: space-between">
        <h5 class="">Installationshinweis</h5>
        <button type="button" class="btn-close" @click="hideBanner()"></button>
      </div>
      <div>
        <div>
          {{ $t('installation.iosSafari') }}
        </div>
        <div class="mb-2">
          <button v-if="operationSystem == 'Android'" type="button" class="btn btn-primary m-1" @click="install()">Installieren</button>
          <button type="button" class="btn btn-danger m-1" @click="dontShowAgain()">Nicht erneut anzeigen</button>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import axios from 'axios'
import { defineComponent } from 'vue'

type OperationSystems = 'Android' | 'iOS' | 'macOS' | 'Unknown' | 'Linux' | 'Windows'
type BrowserTypes = 'Chrome' | 'Safari' | 'Firefox' | 'Unknown' | 'Edge'

export default defineComponent({
  name: 'Installation',
  data() {
    return {
      showInstallationBanner: false as Boolean,
      operationSystem: 'Unknown' as OperationSystems,
      browser: 'Unknown' as BrowserTypes
    }
  },
  props: {},
  methods: {
    hideBanner() {
      this.showInstallationBanner = false
    },
    showBanner() {
      this.showInstallationBanner = true
    },
    async dontShowAgain() {
      let settings = this.$root.user.settings
      settings.showInstallBanner = false
      await this.postSettings(settings)
      this.hideBanner()
    },
    install() {
      let settings = this.$root.user.settings
      settings.showInstallBanner = true
      // hier braucht es noch was zur Erkennung ob die App installiert wurde. bzw etwas da getriggert wird
      this.postSettings(settings)
      this.hideBanner()
    },
    async postSettings(settings: {}) {
      try {
        await axios.post(import.meta.env.VITE_BACKEND_URL + '/user/settings', settings, {
          withCredentials: true
        })
      } catch (error: any) {
        if (error.response.status === 401) {
          this.$router.push('login') // macht das hier sinn?
        } else {
          console.log(error.response.data)
        }
      }
    },
    detectBrowser() {
      const userAgent = navigator.userAgent
      if (/chrome|chromium|crios/i.test(userAgent) && !/edg/i.test(userAgent)) {
        return 'Chrome'
      } else if (/firefox|fxios/i.test(userAgent)) {
        return 'Firefox'
      } else if (/safari/i.test(userAgent) && !/chrome|crios|chromium/i.test(userAgent)) {
        return 'Safari'
      } else if (/edg/i.test(userAgent)) {
        return 'Edge'
      }
      return 'Unknown'
    },
    detectOS() {
      const userAgent = navigator.userAgent

      if (/win/i.test(userAgent)) return 'Windows'
      if (/android/i.test(userAgent)) return 'Android'
      if (/mac/i.test(userAgent)) return this.$root.mobile ? 'iOS' : 'macOS'
      if (/linux/i.test(userAgent)) return 'Linux'
      if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS'
      return 'Unknown'
    }
  },
  mounted() {
    // darum noch kümmern :)
    if (false) {
      window.addEventListener('beforeInstallPrompt', (event) => {})
    }
  },
  beforeMount() {
    this.browser = this.detectBrowser()
    this.operationSystem = this.detectOS()
    // only setting this true, if alreadyInstalled not true AND user setting is true
    this.showInstallationBanner = this.$root.user.settings.showInstallBanner && !this.$root.alreadyInstalled
  }
})
</script>
