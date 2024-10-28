<template>
  <div
    id="installBanner"
    v-if="$root.showInstallationBanner && !alreadyInstalled && mobile"
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
        <button type="button" class="btn-close" @click="hideModal()"></button>
      </div>

      <div>
        <div class="mb-2">
          {{ $t('installation.iosSafari') }}
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
      showInstallationBanner: true as Boolean, //hier einfach auf einen Wert aus den Setting setzen
      alreadyInstalled: false,

      operationSystem: 'Unknown' as OperationSystems,
      browser: 'Unknown' as BrowserTypes,
      mobile: false as boolean | undefined
    }
  },
  props: {},
  methods: {
    hideModal() {
      // this.showInstallationBanner = false
      this.$root.showInstallationBanner = false
    },
    async dontShowAgain() {
      let settings = this.$root.user.settings
      settings.showInstallBanner = false
      this.postSettings(settings)
      this.$root.showInstallationBanner = false
    },
    async postSettings(settings: {}) {
      try {
        await axios.post(import.meta.env.VITE_BACKEND_URL + '/user/settings', settings, {
          withCredentials: true
        })
        console.log('pushing worked')
      } catch (error: any) {
        if (error.response.status === 401) {
          this.$router.push('login')
        } else {
          console.log(error.response.data)
        }
      }
    },
    install() {
      let settings = this.$root.user.settings
      settings.showInstallBanner = true
      this.postSettings(settings)
      this.alreadyInstalled = true
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
      if (/mac/i.test(userAgent)) return this.mobile ? 'iOS' : 'macOS'
      if (/linux/i.test(userAgent)) return 'Linux'
      if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS'
      return 'Unknown'
    }
  },
  mounted() {
    if (false) {
      window.addEventListener('beforeInstallPrompt', (event) => {})
    }
  },
  beforeMount() {
    this.mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    this.browser = this.detectBrowser()
    this.operationSystem = this.detectOS()
  }
})
</script>
