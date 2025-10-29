<template>
  <div
    id="installBanner"
    v-if="showInstallationBanner && isMobile"
    class="bg-body-secondary"
    style="width: 100%; position: fixed; left: 0px; bottom: 0px; z-index: 9999; display: block">
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
                {{ $t('installation.iosSafari.steps.one.one') }}
                <i class="bi bi-box-arrow-up"></i>
                {{ $t('installation.iosSafari.steps.one.two') }}
              </div>
              <div>
                {{ $t('installation.iosSafari.steps.two') }}
                <i class="bi bi-plus-square"></i>
              </div>
              <div>{{ $t('installation.iosSafari.steps.three') }}</div>
            </div>
            <div v-else-if="browser === 'Chrome'">
              <div>
                {{ $t('installation.iosChrome.steps.one.one') }}
                <i class="bi bi-box-arrow-up"></i>
                {{ $t('installation.iosChrome.steps.one.two') }}
              </div>
              <div>
                {{ $t('installation.iosChrome.steps.two') }}
                <i class="bi bi-plus-square"></i>
              </div>
              <div>{{ $t('installation.iosChrome.steps.three') }}</div>
            </div>
            <div v-else-if="browser === 'Firefox'">
              <div>
                {{ $t('installation.iosFirefox.steps.one.one') }}
                <i class="bi bi-list"></i>
                {{ $t('installation.iosFirefox.steps.one.two') }}
              </div>
              <div>
                {{ $t('installation.iosFirefox.steps.two') }}
                <i class="bi bi-box-arrow-up"></i>
              </div>
              <div>
                {{ $t('installation.iosFirefox.steps.three') }}
                <i class="bi bi-plus-square"></i>
              </div>
              <div>{{ $t('installation.iosFirefox.steps.four') }}</div>
            </div>
          </div>
          <div v-else-if="operationSystem === 'Android'">
            <div v-if="browser === 'SamsungInternet'">
              <div>
                {{ $t('installation.AndroidSamsung.steps.one.one') }}
                <i class="bi bi-arrow-down-square"></i>
                {{ $t('installation.AndroidSamsung.steps.one.two') }}
              </div>
              <div>{{ $t('installation.AndroidSamsung.steps.two') }}</div>
            </div>
            <div v-else-if="browser === 'Chrome'">
              <div>
                {{ $t('installation.AndroidChrome.steps.one.one') }}
                <i class="bi bi-three-dots-vertical"></i>
                {{ $t('installation.AndroidChrome.steps.one.two') }}
              </div>
              <div>{{ $t('installation.AndroidChrome.steps.two') }}</div>
              <div>{{ $t('installation.AndroidChrome.steps.three') }}</div>
            </div>
            <div v-else-if="browser === 'Firefox'">
              <div>
                {{ $t('installation.AndroidFirefox.steps.one.one') }}
                <i class="bi bi-three-dots-vertical"></i>
                {{ $t('installation.AndroidFirefox.steps.one.two') }}
              </div>
              <div>{{ $t('installation.AndroidFirefox.steps.two') }}</div>
              <div>{{ $t('installation.AndroidFirefox.steps.three') }}</div>
            </div>
          </div>
          <div v-else>
            <div>{{ $t('installation.default.steps.one') }}</div>
            <div>{{ $t('installation.default.steps.two') }}</div>
          </div>
        </div>
      </div>
      <div id="installationFooter" class="mt-auto" style="bottom: 0px">
        <button type="button" class="btn btn-primary m-1" @click="install()">{{ $t('labels.install') }}</button>
        <button type="button" class="btn btn-danger" @click="dontShowAgain()">{{ $t('labels.dontShowAgain') }}</button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { User } from 'abrechnung-common/types.js'
import { onUnmounted, ref } from 'vue'
import API from '@/api.js'
import APP_LOADER from '@/dataLoader.js'
import { isMobile } from '@/helper.js'

type OsName = 'Android' | 'iOS' | 'macOS' | 'Unknown' | 'Linux' | 'Windows'
type BrowserType = 'Chrome' | 'Safari' | 'Firefox' | 'Unknown' | 'Edge' | 'SamsungInternet'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const APP_DATA = APP_LOADER.data

const eventCatch = (event: Event) => {
  event.preventDefault()
  promptInstallEvent = event as BeforeInstallPromptEvent
}
window.addEventListener('beforeinstallprompt', eventCatch)
defineExpose({ showBanner })

await APP_LOADER.loadData()

const showInstallationBanner = ref(!APP_DATA.value || APP_DATA.value.user.settings.showInstallBanner)
const operationSystem = detectOS()
const browser = detectBrowser()
let promptInstallEvent = undefined as BeforeInstallPromptEvent | undefined

function hideBanner() {
  showInstallationBanner.value = false
}
function showBanner() {
  showInstallationBanner.value = true
}
async function dontShowAgain() {
  if (APP_DATA.value) {
    APP_DATA.value.user.settings.showInstallBanner = false
    await API.setter('user/settings', { showInstallBanner: false } as Partial<User['settings']>, {}, false)
  }
  hideBanner()
}
async function install() {
  if (promptInstallEvent) {
    await promptInstallEvent.prompt()
  }
  promptInstallEvent = undefined
  hideBanner()
}
function detectBrowser(): BrowserType {
  const userAgent = navigator.userAgent
  if (/SamsungBrowser/i.test(userAgent)) return 'SamsungInternet'
  if (/chrome|chromium|crios/i.test(userAgent) && !/edg/i.test(userAgent)) return 'Chrome'
  if (/firefox|fxios/i.test(userAgent)) return 'Firefox'
  if (/safari/i.test(userAgent) && !/chrome|crios|chromium/i.test(userAgent)) return 'Safari'
  if (/edg/i.test(userAgent)) return 'Edge'
  return 'Unknown'
}
function detectOS(): OsName {
  const userAgent = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS'
  if (/win/i.test(userAgent)) return 'Windows'
  if (/android/i.test(userAgent)) return 'Android'
  if (/mac/i.test(userAgent)) return 'macOS'
  if (/linux/i.test(userAgent)) return 'Linux'
  return 'Unknown'
}

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', eventCatch)
})
</script>
