<template>
  <div v-if="APP_DATA" class="admin-section">
    <template v-if="activeSectionId === 'users'">
      <section id="user-list" class="section-anchor">
        <h2 class="h4 mb-3">{{ t('labels.userList') }}</h2>
        <Suspense>
          <template #default>
            <UserList class="mb-5" ref="userList" />
          </template>
          <template #fallback>Loading.. </template>
        </Suspense>
      </section>

      <section id="user-import" class="section-anchor">
        <h2 class="h4 mb-3">{{ t('labels.userImport') }}</h2>
        <CSVImport
          class="mb-5"
          endpoint="admin/user/bulk"
          :transformers="[
            { path: 'projects.assigned', key: 'identifier', array: APP_DATA.projects! },
            { path: 'settings.organisation', key: 'name', array: APP_DATA.organisations },
            { path: 'loseAccessAt', fn: convertGermanDateToHTMLDate }
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
          @submitted="userListRef?.loadFromServer()" />
      </section>

      <section id="merge-users" class="section-anchor">
        <h2 class="h4 mb-3">{{ t('labels.mergeUsers') }}</h2>
        <UserMerge />
      </section>
    </template>

    <template v-else-if="activeSectionId === 'projects'">
      <section id="project-list" class="section-anchor">
        <h2 class="h4 mb-3">{{ t('labels.projectList') }}</h2>
        <Suspense>
          <template #default>
            <ProjectList class="mb-5" ref="projectList" />
          </template>
          <template #fallback>Loading.. </template>
        </Suspense>
      </section>

      <section id="project-import" class="section-anchor">
        <h2 class="h4 mb-3">{{ t('labels.projectImport') }}</h2>
        <CSVImport
          class="mb-5"
          endpoint="admin/project/bulk"
          :transformers="[{ path: 'organisation', key: 'name', array: APP_DATA.organisations }]"
          :template-fields="['identifier', 'name', 'organisation', 'budget.amount']"
          @submitted="projectListRef?.loadFromServer()" />
      </section>
    </template>

    <Suspense v-else-if="activeSectionId === 'organisations'">
      <template #default>
        <OrganisationList />
      </template>
      <template #fallback>Loading.. </template>
    </Suspense>
    <Suspense v-else-if="activeSectionId === 'categories'">
      <template #default>
        <CategoryList />
      </template>
      <template #fallback>Loading.. </template>
    </Suspense>
    <Suspense v-else-if="activeSectionId === 'countries'">
      <template #default>
        <CountryList />
      </template>
      <template #fallback>Loading.. </template>
    </Suspense>
    <Suspense v-else-if="activeSectionId === 'currencies'">
      <template #default>
        <CurrencyList />
      </template>
      <template #fallback>Loading.. </template>
    </Suspense>
    <Suspense v-else-if="activeSectionId === 'healthInsurances'">
      <template #default>
        <HealthInsuranceList />
      </template>
      <template #fallback>Loading.. </template>
    </Suspense>
    <TravelSettingsForm v-else-if="activeSectionId === 'travelSettings'" />
    <ConnectionSettingsForm v-else-if="activeSectionId === 'connectionSettings'" />
    <DisplaySettingsForm v-else-if="activeSectionId === 'displaySettings'" />
    <PrinterSettingsForm v-else-if="activeSectionId === 'printerSettings'" />
    <SettingsForm v-else-if="activeSectionId === 'settings'" />
    <RetentionSettingsForm v-else-if="activeSectionId === 'retentionPolicy'" />
    <Suspense v-else-if="activeSectionId === 'webhooks'">
      <template #default>
        <WebhookList />
      </template>
      <template #fallback>Loading.. </template>
    </Suspense>
    <IntegrationScheduleForm v-else-if="activeSectionId === 'lumpSumSync'" integrationKey="lumpSums" scheduleKey="sync" />
    <StatsPage v-else-if="activeSectionId === 'stats'" />
    <AdminTools v-else-if="activeSectionId === 'adminTools'" />
  </div>
</template>

<script lang="ts" setup>
import { convertGermanDateToHTMLDate } from 'abrechnung-common/utils/scripts.js'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import CSVImport from '@/components/elements/CSVImport.vue'
import APP_LOADER from '@/dataLoader.js'
import { getAdminSectionById, type AdminSectionId } from './adminSections'
import AdminTools from './elements/AdminTools.vue'
import CategoryList from './elements/CategoryList.vue'
import ConnectionSettingsForm from './elements/ConnectionSettingsForm.vue'
import CountryList from './elements/CountryList.vue'
import CurrencyList from './elements/CurrencyList.vue'
import DisplaySettingsForm from './elements/DisplaySettingsForm.vue'
import HealthInsuranceList from './elements/HealthInsuranceList.vue'
import IntegrationScheduleForm from './elements/IntegrationScheduleForm.vue'
import OrganisationList from './elements/OrganisationList.vue'
import PrinterSettingsForm from './elements/PrinterSettingsForm.vue'
import ProjectList from './elements/ProjectList.vue'
import RetentionSettingsForm from './elements/RetentionSettingsForm.vue'
import SettingsForm from './elements/SettingsForm.vue'
import StatsPage from './elements/StatsPage.vue'
import TravelSettingsForm from './elements/TravelSettingsForm.vue'
import UserList from './elements/UserList.vue'
import UserMerge from './elements/UserMerge.vue'
import WebhookList from './elements/WebhookList.vue'

const { t } = useI18n()
const route = useRoute()

const APP_DATA = APP_LOADER.data

const userListRef = useTemplateRef<{ loadFromServer: () => void }>('userList')
const projectListRef = useTemplateRef<{ loadFromServer: () => void }>('projectList')

const activeSectionId = computed(
  () => (getAdminSectionById(route.meta.adminSectionId as AdminSectionId | undefined)?.id ?? 'users') as AdminSectionId
)

async function scrollToHash() {
  if (route.hash) {
    await nextTick()
    const target = document.querySelector(route.hash)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
  }

  window.scrollTo({ top: 0, behavior: 'auto' })
}

watch(() => route.fullPath, scrollToHash, { immediate: true })
</script>

<style scoped>
.admin-section {
  display: grid;
  gap: 1.5rem;
}

.section-anchor {
  scroll-margin-top: 6rem;
}
</style>
