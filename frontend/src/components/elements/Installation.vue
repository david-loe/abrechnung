<template>
  <div
    id="installBanner"
    v-if="showInstallationBanner && $root.mobile"
    style="
      width: 100%;
      position: fixed;
      left: 0px;
      bottom: 0px;
      z-index: 4000;
      display: block;
      background-color: rgb(240, 240, 240, 1);
      justify-content: center;
    ">
    <div class="container-lg p-3">
      <div id="installationHeader" style="display: flex; justify-content: space-between">
        <h5 class="">{{ $t('installation.header') }}</h5>
        <button type="button" class="btn-close" @click="hideBanner()"></button>
      </div>
      <div>
        <div v-if="!promptInstallEvent" id="installationBody" class="my-1">
          <div v-if="operationSystem === 'iOS'">
            <div v-if="browser === 'Safari'">
              <div>
                {{ $t('installation.iosSafari.steps.one.one') }} <i class="bi bi-box-arrow-up"></i
                >{{ $t('installation.iosSafari.steps.one.two') }}
              </div>
              <div>{{ $t('installation.iosSafari.steps.two') }} <i class="bi bi-plus-square"></i></div>
              <div>{{ $t('installation.iosSafari.steps.three') }}</div>
            </div>
            <div v-else-if="browser === 'Chrome'">
              <div>
                {{ $t('installation.iosChrome.steps.one.one') }} <i class="bi bi-box-arrow-up"></i
                >{{ $t('installation.iosChrome.steps.one.two') }}
              </div>
              <div>{{ $t('installation.iosChrome.steps.two') }} <i class="bi bi-plus-square"></i></div>
              <div>{{ $t('installation.iosChrome.steps.three') }}</div>
            </div>
            <div v-else-if="browser === 'Firefox'">
              <div>
                {{ $t('installation.iosFirefox.steps.one.one') }} <i class="bi bi-list"></i
                >{{ $t('installation.iosFirefox.steps.one.two') }}
              </div>
              <div>{{ $t('installation.iosFirefox.steps.two') }} <i class="bi bi-box-arrow-up"></i></div>
              <div>{{ $t('installation.iosFirefox.steps.three') }} <i class="bi bi-plus-square"></i></div>
              <div>{{ $t('installation.iosFirefox.steps.four') }}</div>
            </div>
          </div>
          <div v-else-if="operationSystem === 'Android'">
            <div v-if="browser === 'SamsungInternet'">
              <div>
                {{ $t('installation.AndroidSamsung.steps.one.one') }} <i class="bi bi-arrow-down-square"></i
                >{{ $t('installation.AndroidSamsung.steps.one.two') }}
              </div>
              <div>{{ $t('installation.AndroidSamsung.steps.two') }}</div>
            </div>
            <div v-else-if="browser === 'Chrome'">
              <div>
                {{ $t('installation.AndroidChrome.steps.one.one') }} <i class="bi bi-three-dots-vertical"></i
                >{{ $t('installation.AndroidChrome.steps.one.two') }}
              </div>
              <div>{{ $t('installation.AndroidChrome.steps.two') }}</div>
              <div>{{ $t('installation.AndroidChrome.steps.three') }}</div>
            </div>
            <div v-else-if="browser === 'Firefox'">
              <div>
                {{ $t('installation.AndroidFirefox.steps.one.one') }} <i class="bi bi-three-dots-vertical"></i
                >{{ $t('installation.AndroidFirefox.steps.one.two') }}
              </div>
              <div>{{ $t('installation.AndroidFirefox.steps.two') }}</div>
              <div>{{ $t('installation.AndroidFirefox.steps.three') }}</div>
            </div>
          </div>
        </div>
      </div>
      <div id="installationFooter" class="mt-auto" style="bottom: 0px">
        <button v-if="promptInstallEvent" type="button" class="btn btn-primary m-1" @click="install()">{{ $t('labels.install') }}</button>
        <button type="button" class="btn btn-danger" @click="dontShowAgain()">{{ $t('labels.dontshowagain') }}</button>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import axios from 'axios'
import { defineComponent } from 'vue'

type OperationSystems = 'Android' | 'iOS' | 'macOS' | 'Unknown' | 'Linux' | 'Windows'
type BrowserTypes = 'Chrome' | 'Safari' | 'Firefox' | 'Unknown' | 'Edge' | 'SamsungInternet'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export default defineComponent({
  name: 'Installation',
  data() {
    return {
      showInstallationBanner: false as Boolean,
      operationSystem: 'Unknown' as OperationSystems,
      browser: 'Unknown' as BrowserTypes,
      promptInstallEvent: undefined as BeforeInstallPromptEvent | undefined
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
    async install() {
      if (this.promptInstallEvent) {
        await this.promptInstallEvent.prompt()
      }
      this.promptInstallEvent = undefined
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
      if (/SamsungBrowser/i.test(userAgent)) {
        return 'SamsungInternet'
      } else if (/chrome|chromium|crios/i.test(userAgent) && !/edg/i.test(userAgent)) {
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
  },
  beforeMount() {
    this.browser = this.detectBrowser()
    this.operationSystem = this.detectOS()
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log('event catched')
      event.preventDefault()
      this.promptInstallEvent = event as BeforeInstallPromptEvent
    })
    // only setting this true, if alreadyInstalled not true AND user setting is true
    this.showInstallationBanner = this.$root.user.settings.showInstallBanner && !this.$root.alreadyInstalled
    console.log(this.showInstallationBanner)
  }
})
</script>
