<template>
  <div v-if="APP_DATA" class="d-lg-flex">
    <div class="sidebar">
      <div class="offcanvas-body flex-column pt-lg-3 overflow-y-auto">
        <ul class="nav nav-pills flex-column">
          <li v-for="_entry in items" class="nav-item">
            <span :class="'nav-link clickable ' + (_entry === entry ? 'active' : 'link-body-emphasis')" @click="entry = _entry">
              {{ t('labels.' + _entry) }}
            </span>
          </li>
          <li class="border-top my-3"></li>
          <li v-for="_entry in settings" class="nav-item">
            <span :class="'nav-link clickable ' + (_entry === entry ? 'active' : 'link-body-emphasis')" @click="entry = _entry">
              {{ t('labels.' + _entry) }}
            </span>
          </li>
        </ul>
      </div>
    </div>
    <div class="flex-grow-1" id="settingsContent">
      <div class="container px-lg-4 py-3">
        <h2 class="mb-3">{{ t('labels.' + entry) }}</h2>
        <SettingsForm v-if="entry === 'settings'" />
        <ConnectionSettingsForm v-else-if="entry === 'connectionSettings'" />
        <DisplaySettingsForm v-else-if="entry === 'displaySettings'" />
        <TravelSettingsForm v-else-if="entry === 'travelSettings'" />
        <PrinterSettingsForm v-else-if="entry === 'printerSettings'" />
        <StatsPage v-else-if="entry === 'stats'" />
        <template v-else-if="entry === 'users'">
          <Suspense>
            <template #default>
              <UserList class="mb-5" ref="userList" />
            </template>
            <template #fallback>Loading.. </template>
          </Suspense>

          <h3>{{ t('labels.import') }}</h3>
          <CSVImport
            class="mb-5"
            endpoint="admin/user/bulk"
            :transformers="[
              { path: 'projects.assigned', key: 'identifier', array: APP_DATA.projects! },
              { path: 'settings.organisation', key: 'name', array: APP_DATA.organisations },
              {path: 'loseAccessAt', fn: convertGermanDateToHTMLDate}
            ]"
            :template-fields="[
              'name.givenName',
              'name.familyName',
              'email',
              'fk.magiclogin',
              'loseAccessAt',
              'projects.assigned',
              'settings.organisation'
            ]"
            @submitted=";($refs.userList as any).loadFromServer()" />
          <h3>{{ t('labels.mergeUsers') }}</h3>
          <UserMerge />
        </template>
        <template v-else-if="entry === 'projects'">
          <Suspense>
            <template #default>
              <ProjectList class="mb-5" ref="projectList" />
            </template>
            <template #fallback>Loading.. </template>
          </Suspense>

          <h3>{{ t('labels.import') }}</h3>
          <CSVImport
            class="mb-5"
            endpoint="admin/project/bulk"
            :transformers="[{ path: 'organisation', key: 'name', array: APP_DATA.organisations }]"
            :template-fields="['identifier', 'name', 'organisation', 'budget.amount']"
            @submitted=";($refs.projectList as any).loadFromServer()" />
        </template>
        <Suspense v-else-if="entry === 'organisations'">
          <template #default>
            <OrganisationList />
          </template>
          <template #fallback>Loading.. </template>
        </Suspense>
        <Suspense v-else-if="entry === 'categories'">
          <template #default>
            <CategoryList />
          </template>
          <template #fallback>Loading.. </template>
        </Suspense>
        <Suspense v-else-if="entry === 'webhooks'">
          <template #default>
            <WebhookList />
          </template>
          <template #fallback>Loading.. </template>
        </Suspense>
        <Suspense v-else-if="entry === 'countries'">
          <template #default>
            <CountryList />
          </template>
          <template #fallback>Loading.. </template>
        </Suspense>
        <Suspense v-else-if="entry === 'currencies'">
          <template #default>
            <CurrencyList />
          </template>
          <template #fallback>Loading.. </template>
        </Suspense>
        <Suspense v-else-if="entry === 'healthInsurances'">
          <template #default>
            <HealthInsuranceList />
          </template>
          <template #fallback>Loading.. </template>
        </Suspense>
      </div>
    </div>
    <div class="invisible" :style="{ width: rightMargin }"></div>
  </div>
</template>

<script lang="ts" setup>
import { convertGermanDateToHTMLDate } from 'abrechnung-common/utils/scripts.js'
import CSVImport from '@/components/elements/CSVImport.vue'
import CategoryList from '@/components/settings/elements/CategoryList.vue'
import ConnectionSettingsForm from '@/components/settings/elements/ConnectionSettingsForm.vue'
import CountryList from '@/components/settings/elements/CountryList.vue'
import CurrencyList from '@/components/settings/elements/CurrencyList.vue'
import DisplaySettingsForm from '@/components/settings/elements/DisplaySettingsForm.vue'
import HealthInsuranceList from '@/components/settings/elements/HealthInsuranceList.vue'
import OrganisationList from '@/components/settings/elements/OrganisationList.vue'
import PrinterSettingsForm from '@/components/settings/elements/PrinterSettingsForm.vue'
import ProjectList from '@/components/settings/elements/ProjectList.vue'
import SettingsForm from '@/components/settings/elements/SettingsForm.vue'
import StatsPage from '@/components/settings/elements/StatsPage.vue'
import TravelSettingsForm from '@/components/settings/elements/TravelSettingsForm.vue'
import UserList from '@/components/settings/elements/UserList.vue'
import UserMerge from '@/components/settings/elements/UserMerge.vue'
import APP_LOADER from '@/dataLoader.js'
import '@vueform/vueform/dist/vueform.css'
import '@/vueform.css'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import WebhookList from './elements/WebhookList.vue'

const { t } = useI18n()

const items = ['users', 'projects', 'organisations', 'categories', 'webhooks', 'countries', 'currencies', 'healthInsurances'] as const

const settings = ['travelSettings', 'connectionSettings', 'displaySettings', 'printerSettings', 'settings', 'stats'] as const

type Entry = (typeof items)[number] | (typeof settings)[number]

const APP_DATA = APP_LOADER.data
const entry = ref('users' as Entry)

const rightMargin = computed(() => {
  const container = document.getElementById('navBarContent')
  let width = 0
  if (container) {
    width = container.getBoundingClientRect().right - container.getBoundingClientRect().width
  }
  return `${width}px`
})

await APP_LOADER.loadData()
</script>

<style></style>
