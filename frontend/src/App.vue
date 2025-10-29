<template>
  <OfflineBanner ref="offlineBanner" />
  <ModalComponent v-if="APP_DATA" header="API Key" ref="modalComp" @afterClose=";($refs.apiKeyForm as any).resetForm()">
    <ApiKeyForm :user="APP_DATA.user" endpoint="user/httpBearer" @cancel=";($refs.modalComp as any).hideModal()" ref="apiKeyForm" />
  </ModalComponent>
  <HeaderComponent :language="APP_LOGIN_DATA?.language" @update:language="updateLanguage">
    <template v-if="APP_DATA">
      <template v-for="access of accesses" :key="access">
        <template v-if="access.indexOf(':') === -1 && APP_DATA.user.access[access]">
          <li class="nav-item d-flex align-items-center">
            <router-link :to="'/' + access" class="nav-link link-body-emphasis d-flex align-items-center">
              <i v-for="icon of APP_DATA.displaySettings.accessIcons[access]" :class="'bi bi-' + icon"></i>
              <span class="ms-1">{{ t('accesses.' + access) }}</span>
            </router-link>
          </li>
        </template>
      </template>
      <li class="nav-item dropdown">
        <a class="nav-link link-body-emphasis d-flex align-items-center dropdown-toggle" data-bs-toggle="dropdown" href="#" role="button">
          <i class="fs-4 bi bi-person-circle"></i>
          <span class="ms-1">{{ APP_DATA.user.name.givenName }}</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end">
          <li>
            <button @click=";($refs.modalComp as any).modal.show()" class="d-flex align-items-center dropdown-item">
              <i class="fs-4 bi bi-key"></i>
              <span class="ms-1">API Key</span>
            </button>
          </li>
          <template v-if="isMobile && !alreadyInstalled && !offlineBannerRef?.isOffline">
            <li>
              <hr class="dropdown-divider" >
            </li>
            <li>
              <button @click="showInstallBanner" class="d-flex align-items-center dropdown-item">
                <i class="fs-4 bi bi-box-arrow-down"></i>
                <span class="ms-1">{{ t('labels.installApp') }}</span>
              </button>
            </li>
          </template>
          <li>
            <hr class="dropdown-divider" >
          </li>
          <li>
            <a class="d-flex align-items-center dropdown-item" href="#" @click="logout">
              <i class="fs-4 bi bi-box-arrow-left"></i>
              <span class="ms-1">{{ t('headlines.logout') }}</span>
            </a>
          </li>
        </ul>
      </li>
    </template>
    <div v-else>
      <router-link to="/login" class="nav-link link-body-emphasis d-flex align-items-center">
        <i class="fs-4 bi bi-box-arrow-in-right"></i>
        <span class="ms-1">{{ t('headlines.login') }}</span>
      </router-link>
    </div>
  </HeaderComponent>

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
    <AlertComponent />
    <router-view :class="loadState === 'LOADED' ? 'd-block' : 'd-none'" v-slot="{ Component }">
      <template v-if="Component">
        <Suspense>
          <template #default>
            <component :is="Component"></component>
          </template>
          <template #fallback></template>
        </Suspense>
      </template>
    </router-view>
  </div>
  <FooterComponent :version="APP_DATA?.settings.version" />
  <Suspense>
    <template #default>
      <InstallationBanner
        ref="installBanner"
        v-if="loadState === 'LOADED' && APP_DATA?.user && !offlineBannerRef?.isOffline && !alreadyInstalled" />
    </template>
    <template #fallback>Loading.. </template>
  </Suspense>
</template>

<script lang="ts" setup>
import { accesses, Locale, User } from 'abrechnung-common/types.js'
import { onMounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import API from '@/api.js'
import AlertComponent from '@/components/elements/AlertComponent.vue'
import ApiKeyForm from '@/components/elements/ApiKeyForm.vue'
import FooterComponent from '@/components/elements/FooterComponent.vue'
import HeaderComponent from '@/components/elements/HeaderComponent.vue'
import InstallationBanner from '@/components/elements/InstallationBanner.vue'
import ModalComponent from '@/components/elements/ModalComponent.vue'
import OfflineBanner from '@/components/elements/OfflineBanner.vue'
import APP_LOADER from '@/dataLoader.js'
import { isMobile, subscribeToPush } from '@/helper.js'
import { clearStore } from './indexedDB'

const router = useRouter()
const { t } = useI18n()

const APP_DATA = APP_LOADER.data
const APP_LOGIN_DATA = APP_LOADER.loginData
const loadState = APP_LOADER.state
const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches

const installationBannerRef = useTemplateRef('installBanner')
const offlineBannerRef = useTemplateRef('offlineBanner')

async function logout() {
  const success = await API.deleter('auth/logout', {}, false, { success: false, error: true })
  if (success) {
    APP_LOADER.data.value = null
    clearStore('urls')
    router.push({ path: '/login' })
  }
}
async function updateLanguage(locale: Locale) {
  if (APP_LOGIN_DATA.value) {
    APP_LOGIN_DATA.value.language = locale
  }
  if (APP_DATA.value) {
    APP_DATA.value.user.settings.language = locale
    APP_DATA.value.user.settings.hasUserSetLanguage = true
    await API.setter('user/settings', { language: locale, hasUserSetLanguage: true } as Partial<User['settings']>, {}, false)
  }
}

function showInstallBanner() {
  if (installationBannerRef.value) {
    installationBannerRef.value.showBanner()
  }
}

onMounted(() => {
  if (!offlineBannerRef.value?.isOffline) {
    subscribeToPush()
  }
})
</script>

<style></style>
