<template>
  <div v-if="APP_DATA" class="container">
    <div class="row">
      <div class="col-auto">
        <div class="d-flex flex-column flex-shrink-0 p-3" style="width: 280px; height: 100%">
          <ul class="nav nav-pills flex-column">
            <li v-for="_entry in entries" class="nav-item">
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
      <div class="col">
        <h1>{{ $t('labels.' + entry) }}</h1>
        <SettingsForm v-if="entry === 'settings'" />
        <ConnectionSettingsForm v-if="entry === 'connectionSettings'" />
        <DisplaySettingsForm v-if="entry === 'displaySettings'" />
        <template v-else-if="entry === 'users'">
          <Suspense>
            <template #default>
              <UserList class="mb-5" ref="userList" />
            </template>
            <template #fallback> Loading.. </template>
          </Suspense>

          <h2>{{ $t('labels.csvImport') }}</h2>
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
          <h2>{{ $t('labels.mergeUsers') }}</h2>
          <UserMerge />
        </template>
        <template v-else-if="entry === 'projects'">
          <Suspense>
            <template #default>
              <ProjectList class="mb-5" ref="projectList" />
            </template>
            <template #fallback> Loading.. </template>
          </Suspense>

          <h2>{{ $t('labels.csvImport') }}</h2>
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
  </div>
</template>

<script lang="ts">
import APP_LOADER from '@/appData.js'
import ConnectionSettingsForm from '@/components/settings/elements/ConnectionSettingsForm.vue'
import CountryList from '@/components/settings/elements/CountryList.vue'
import CSVImport from '@/components/settings/elements/CSVImport.vue'
import CurrencyList from '@/components/settings/elements/CurrencyList.vue'
import DisplaySettingsForm from '@/components/settings/elements/DisplaySettingsForm.vue'
import HealthInsuranceList from '@/components/settings/elements/HealthInsuranceList.vue'
import OrganisationList from '@/components/settings/elements/OrganisationList.vue'
import ProjectList from '@/components/settings/elements/ProjectList.vue'
import SettingsForm from '@/components/settings/elements/SettingsForm.vue'
import UserList from '@/components/settings/elements/UserList.vue'
import UserMerge from '@/components/settings/elements/UserMerge.vue'
import { defineComponent } from 'vue'

const entries = [
  'users',
  'projects',
  'organisations',
  'countries',
  'currencies',
  'healthInsurances',
  'settings',
  'connectionSettings',
  'displaySettings'
] as const

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
    DisplaySettingsForm
  },
  data() {
    return {
      entries,
      APP_DATA: APP_LOADER.data,
      entry: 'users' as (typeof entries)[number]
    }
  },
  props: [],

  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
