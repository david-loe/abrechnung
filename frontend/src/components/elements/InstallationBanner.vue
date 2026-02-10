<template>
  <div
    id="installBanner"
    v-if="showInstallationBanner && isMobile"
    class="bg-body-secondary"
    style="width: 100%; position: fixed; left: 0px; bottom: 0px; z-index: 9999; display: block">
    <div class="container p-2">
      <div id="installationHeader" class="d-flex justify-content-between mb-2">
        <span class="fs-5">{{ t('installation.header') }}</span>
        <button type="button" class="btn-close" @click="hideBanner()"></button>
      </div>
      <div v-if="!promptInstallEvent" id="installationBody" class="mb-2">
        <div v-if="operationSystem === 'iOS' && iosBrowsers.includes(browser)">
          <div v-if="browser === 'Safari'">
            <div>
              {{ t('installation.iosSafari.steps.one.one') }}
              <i class="bi bi-box-arrow-up"></i>
              {{ t('installation.iosSafari.steps.one.two') }}
            </div>
            <div>
              {{ t('installation.iosSafari.steps.two') }}
              <i class="bi bi-plus-square"></i>
            </div>
            <div>{{ t('installation.iosSafari.steps.three') }}</div>
          </div>
          <div v-else-if="browser === 'Chrome'">
            <div>
              {{ t('installation.iosChrome.steps.one.one') }}
              <i class="bi bi-box-arrow-up"></i>
              {{ t('installation.iosChrome.steps.one.two') }}
            </div>
            <div>
              {{ t('installation.iosChrome.steps.two') }}
              <i class="bi bi-plus-square"></i>
            </div>
            <div>{{ t('installation.iosChrome.steps.three') }}</div>
          </div>
          <div v-else-if="browser === 'Firefox'">
            <div>
              {{ t('installation.iosFirefox.steps.one.one') }}
              <i class="bi bi-list"></i>
              {{ t('installation.iosFirefox.steps.one.two') }}
            </div>
            <div>
              {{ t('installation.iosFirefox.steps.two') }}
              <i class="bi bi-box-arrow-up"></i>
            </div>
            <div>
              {{ t('installation.iosFirefox.steps.three') }}
              <i class="bi bi-plus-square"></i>
            </div>
            <div>{{ t('installation.iosFirefox.steps.four') }}</div>
          </div>
        </div>
        <div v-else-if="operationSystem === 'Android' && androidBrowser.includes(browser)">
          <div v-if="browser === 'SamsungInternet'">
            <div>
              {{ t('installation.AndroidSamsung.steps.one.one') }}
              <i class="bi bi-arrow-down-square"></i>
              {{ t('installation.AndroidSamsung.steps.one.two') }}
            </div>
            <div>{{ t('installation.AndroidSamsung.steps.two') }}</div>
          </div>
          <div v-else-if="browser === 'Chrome'">
            <div>
              {{ t('installation.AndroidChrome.steps.one.one') }}
              <i class="bi bi-three-dots-vertical"></i>
              {{ t('installation.AndroidChrome.steps.one.two') }}
            </div>
            <div>{{ t('installation.AndroidChrome.steps.two') }}</div>
            <div>{{ t('installation.AndroidChrome.steps.three') }}</div>
          </div>
          <div v-else-if="browser === 'Firefox'">
            <div>
              {{ t('installation.AndroidFirefox.steps.one.one') }}
              <i class="bi bi-three-dots-vertical"></i>
              {{ t('installation.AndroidFirefox.steps.one.two') }}
            </div>
            <div>{{ t('installation.AndroidFirefox.steps.two') }}</div>
            <div>{{ t('installation.AndroidFirefox.steps.three') }}</div>
          </div>
        </div>
        <div v-else>
          <div>{{ t('installation.default.steps.one') }}</div>
          <div>{{ t('installation.default.steps.two') }}</div>
        </div>
      </div>
      <div id="installationFooter" class="d-flex">
        <button v-if="promptInstallEvent" type="button" class="btn btn-primary" @click="install()">{{ t('labels.install') }}</button>
        <button type="button" class="btn btn-sm btn-secondary ms-auto" @click="dontShowAgain()">{{ t('labels.dontShowAgain') }}</button>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { User } from 'abrechnung-common/types.js'
import { onMounted, onUnmounted, ref } from 'vue'
import API from '@/api.js'
import APP_LOADER from '@/dataLoader.js'
import { isMobile } from '@/helper.js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

type OsName = 'Android' | 'iOS' | 'macOS' | 'Unknown' | 'Linux' | 'Windows'
type BrowserType = 'Chrome' | 'Safari' | 'Firefox' | 'Unknown' | 'Edge' | 'SamsungInternet'

const iosBrowsers: BrowserType[] = ['Safari', 'Chrome', 'Firefox']
const androidBrowser: BrowserType[] = ['SamsungInternet', 'Chrome', 'Firefox']

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

const APP_DATA = APP_LOADER.data

function eventCatch(event: Event) {
  event.preventDefault()
  promptInstallEvent.value = event as BeforeInstallPromptEvent
}

function appInstalled() {
  promptInstallEvent.value = undefined
  hideBanner()
}

defineExpose({ showBanner })

await APP_LOADER.loadData()

const showInstallationBanner = ref(!APP_DATA.value || APP_DATA.value.user.settings.showInstallBanner)
const operationSystem = detectOS()
const browser = detectBrowser()
const promptInstallEvent = ref<BeforeInstallPromptEvent | undefined>()

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
  if (promptInstallEvent.value) {
    await promptInstallEvent.value.prompt()
    await promptInstallEvent.value.userChoice
  }
  promptInstallEvent.value = undefined
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

onMounted(() => {
  window.addEventListener('beforeinstallprompt', eventCatch)
  window.addEventListener('appinstalled', appInstalled)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', eventCatch)
  window.removeEventListener('appinstalled', appInstalled)
})
</script>
