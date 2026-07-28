<template>
  <div v-if="APP_DATA" class="container py-3 mx-auto" style="max-width: 720px">
    <h2 class="mb-4">{{ t('labels.userSettings') }}</h2>

    <section class="card mb-4">
      <div class="card-body">
        <h3 class="h5 card-title mb-3">{{ t('labels.general') }}</h3>
        <form @submit.prevent="saveGeneralSettings">
          <div class="mb-3">
            <label for="user-settings-language" class="form-label">{{ t('labels.language') }}</label>
            <select id="user-settings-language" v-model="generalSettings.language" class="form-select" required>
              <option v-for="language in locales" :key="language" :value="language">{{ t(`languages.${language}`) }}</option>
            </select>
          </div>

          <div class="mb-3">
            <label class="form-label">{{ t('labels.organisation') }}</label>
            <OrganisationSelector v-model="generalSettings.organisation" />
          </div>

          <div v-if="!APP_DATA.settings.disableReportType.healthCareCost" class="mb-3">
            <label class="form-label">{{ t('labels.healthInsurance') }}</label>
            <HealthInsuranceSelector v-model="generalSettings.insurance" />
          </div>

          <div class="form-check mb-3">
            <input id="user-settings-install-banner" v-model="generalSettings.showInstallBanner" class="form-check-input" type="checkbox" >
            <label for="user-settings-install-banner" class="form-check-label">{{ t('labels.showInstallBanner') }}</label>
          </div>

          <button type="submit" class="btn btn-primary" :disabled="savingGeneralSettings">{{ t('labels.save') }}</button>
        </form>
      </div>
    </section>

    <section class="card mb-4">
      <div class="card-body">
        <h3 class="h5 card-title mb-3">{{ t('labels.bankAccount') }}</h3>
        <BankAccountForm
          :model-value="APP_DATA.user.settings.bankAccount"
          @update:model-value="updateBankAccount" />
      </div>
    </section>

    <section class="card mb-4">
      <div class="card-body">
        <h3 class="h5 card-title mb-3">{{ t('labels.vehicleRegistration') }}</h3>
        <FileUpload
          id="user-settings-vehicle-registration"
          :model-value="vehicleRegistration"
          multiple
          @update:model-value="saveVehicleRegistration" />
        <span v-if="savingVehicleRegistration" class="spinner-border spinner-border-sm mt-2"></span>
      </div>
    </section>

    <section class="card">
      <div class="card-body">
        <h3 class="h5 card-title mb-3">API Key</h3>
        <ApiKeyForm
          :user="APP_DATA.user"
          endpoint="user/httpBearer"
          :show-cancel="false"
          @new-key="markApiKeyConfigured" />
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { type BankAccount, type DocumentFile, locales, type User } from 'abrechnung-common/types.js'
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import API from '@/api.js'
import ApiKeyForm from '@/components/elements/ApiKeyForm.vue'
import BankAccountForm from '@/components/elements/BankAccountForm.vue'
import FileUpload from '@/components/elements/FileUpload.vue'
import HealthInsuranceSelector from '@/components/elements/HealthInsuranceSelector.vue'
import OrganisationSelector from '@/components/elements/OrganisationSelector.vue'
import APP_LOADER from '@/dataLoader.js'

const { t, locale } = useI18n()
await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data
const savingGeneralSettings = ref(false)
const savingVehicleRegistration = ref(false)
const currentSettings = APP_DATA.value!.user.settings
const generalSettings = reactive({
  language: currentSettings.language,
  organisation: currentSettings.organisation ?? null,
  insurance: currentSettings.insurance,
  showInstallBanner: currentSettings.showInstallBanner
})
const vehicleRegistration = ref([...(APP_DATA.value!.user.vehicleRegistration ?? [])])

async function saveGeneralSettings() {
  savingGeneralSettings.value = true
  const result = await API.setter<User<string>['settings']>('user/settings', {
    language: generalSettings.language,
    hasUserSetLanguage: true,
    organisation: generalSettings.organisation?._id ?? null,
    insurance: generalSettings.insurance?._id ?? null,
    showInstallBanner: generalSettings.showInstallBanner
  })
  savingGeneralSettings.value = false
  if (result.ok && APP_DATA.value) {
    APP_DATA.value.user = { ...APP_DATA.value.user, settings: result.ok }
    locale.value = result.ok.language
    if (APP_LOADER.loginData.value) APP_LOADER.loginData.value.language = result.ok.language
  }
}

function updateBankAccount(bankAccount: BankAccount | null) {
  if (APP_DATA.value) APP_DATA.value.user.settings.bankAccount = bankAccount
}

async function saveVehicleRegistration(files: Partial<DocumentFile<string, Blob>>[]) {
  savingVehicleRegistration.value = true
  vehicleRegistration.value = files as DocumentFile<string>[]
  const result = await API.setter<User<string>>(
    'user/vehicleRegistration',
    { vehicleRegistration: files },
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  savingVehicleRegistration.value = false
  if (result.ok && APP_DATA.value) {
    APP_DATA.value.user = result.ok
    vehicleRegistration.value = result.ok.vehicleRegistration ?? []
  }
}

function markApiKeyConfigured() {
  if (APP_DATA.value) APP_DATA.value.user.fk.httpBearer = 'configured'
}
</script>
