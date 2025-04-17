<template>
  <div v-if="APP_DATA" class="d-lg-flex">
    <div class="sidebar">
      <div class="offcanvas-body flex-column pt-lg-3 overflow-y-auto">
        <ul class="nav nav-pills flex-column">
          <li v-for="_entry in items" class="nav-item">
            <span
              style="cursor: pointer"
              :class="'nav-link ' + (_entry === entry ? 'active' : 'link-body-emphasis')"
              @click="entry = _entry">
              {{ $t('labels.' + _entry) }}
            </span>
          </li>
          <li class="border-top my-3"></li>
          <li v-for="_entry in settings" class="nav-item">
            <span
              style="cursor: pointer"
              :class="'nav-link ' + (_entry === entry ? 'active' : 'link-body-emphasis')"
              @click="entry = _entry">
              {{ $t('labels.' + _entry) }}
            </span>
          </li>
        </ul>
      </div>
    </div>
    <div class="flex-grow-1" id="settingsContent">
      <div class="container px-lg-4 py-3">
        <h2 class="mb-3">{{ $t('labels.' + entry) }}</h2>
        <SettingsForm v-if="entry === 'settings'" />
        <ConnectionSettingsForm v-else-if="entry === 'connectionSettings'" />
        <DisplaySettingsForm v-else-if="entry === 'displaySettings'" />
        <TravelSettingsForm v-else-if="entry === 'travelSettings'" />
        <PrinterSettingsForm v-else-if="entry === 'printerSettings'" />
        <template v-else-if="entry === 'users'">
          <Suspense>
            <template #default>
              <UserList class="mb-5" ref="userList" />
            </template>
            <template #fallback> Loading.. </template>
          </Suspense>

          <h3>{{ $t('labels.csvImport') }}</h3>
          <CSVImport
            class="mb-5"
            endpoint="admin/user/bulk"
            :transformers="[
              { path: 'projects.assigned', key: 'identifier', array: APP_DATA.projects! },
              { path: 'settings.organisation', key: 'name', array: APP_DATA.organisations },
              {path: 'loseAccessAt', fn: (val:string|undefined) => {
                if(val){
                  const match = val.match(/^(?<d>[0-3]?\d)\.(?<m>[0-1]?\d).(?<y>\d\d\d\d)$/)
                  if(match){
                    return match.groups!.y + '-' + match.groups!.m.padStart(2, '0') + '-' + match.groups!.d.padStart(2, '0')
                  }
                }
                return val
              }}
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
            @imported=";($refs.userList as any).loadFromServer()" />
          <h3>{{ $t('labels.mergeUsers') }}</h3>
          <UserMerge />
        </template>
        <template v-else-if="entry === 'projects'">
          <Suspense>
            <template #default>
              <ProjectList class="mb-5" ref="projectList" />
            </template>
            <template #fallback> Loading.. </template>
          </Suspense>

          <h3>{{ $t('labels.csvImport') }}</h3>
          <CSVImport
            class="mb-5"
            endpoint="admin/project/bulk"
            :transformers="[{ path: 'organisation', key: 'name', array: APP_DATA.organisations }]"
            :template-fields="['identifier', 'name', 'organisation', 'budget.amount']"
            @imported=";($refs.projectList as any).loadFromServer()" />
        </template>
        <Suspense v-else-if="entry === 'organisations'">
          <template #default>
            <OrganisationList />
          </template>
          <template #fallback> Loading.. </template>
        </Suspense>
        <Suspense v-else-if="entry === 'countries'">
          <template #default>
            <CountryList />
          </template>
          <template #fallback> Loading.. </template>
        </Suspense>
        <Suspense v-else-if="entry === 'currencies'">
          <template #default>
            <CurrencyList />
          </template>
          <template #fallback> Loading.. </template>
        </Suspense>
        <Suspense v-else-if="entry === 'healthInsurances'">
          <template #default>
            <HealthInsuranceList />
          </template>
          <template #fallback> Loading.. </template>
        </Suspense>
      </div>
    </div>
    <div class="invisible" :style="{ width: rightMargin }"></div>
  </div>
</template>

<script lang="ts">
import APP_LOADER from '@/appData.js'
import CSVImport from '@/components/settings/elements/CSVImport.vue'
import ConnectionSettingsForm from '@/components/settings/elements/ConnectionSettingsForm.vue'
import CountryList from '@/components/settings/elements/CountryList.vue'
import CurrencyList from '@/components/settings/elements/CurrencyList.vue'
import DisplaySettingsForm from '@/components/settings/elements/DisplaySettingsForm.vue'
import HealthInsuranceList from '@/components/settings/elements/HealthInsuranceList.vue'
import OrganisationList from '@/components/settings/elements/OrganisationList.vue'
import PrinterSettingsForm from '@/components/settings/elements/PrinterSettingsForm.vue'
import ProjectList from '@/components/settings/elements/ProjectList.vue'
import SettingsForm from '@/components/settings/elements/SettingsForm.vue'
import TravelSettingsForm from '@/components/settings/elements/TravelSettingsForm.vue'
import UserList from '@/components/settings/elements/UserList.vue'
import UserMerge from '@/components/settings/elements/UserMerge.vue'
import { defineComponent } from 'vue'

const items = ['users', 'projects', 'organisations', 'countries', 'currencies', 'healthInsurances'] as const

const settings = ['travelSettings', 'connectionSettings', 'displaySettings', 'printerSettings', 'settings'] as const

type Entry = (typeof items)[number] | (typeof settings)[number]

export default defineComponent({
  name: 'SettingsPage',
  components: {
    UserList,
    SettingsForm,
    OrganisationList,
    ProjectList,
    CountryList,
    CurrencyList,
    HealthInsuranceList,
    UserMerge,
    CSVImport,
    ConnectionSettingsForm,
    DisplaySettingsForm,
    TravelSettingsForm,
    PrinterSettingsForm
  },
  data() {
    return {
      items,
      settings,
      APP_DATA: APP_LOADER.data,
      entry: 'users' as Entry
    }
  },
  props: [],

  computed: {
    rightMargin() {
      const container = document.getElementById('navBarContent')
      let width = 0
      if (container) {
        width = container.getBoundingClientRect().right - container.getBoundingClientRect().width
      }
      return `${width}px`
    }
  },

  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
