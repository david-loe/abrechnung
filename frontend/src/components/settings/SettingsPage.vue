<template>
  <div class="container">
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
        <template v-else-if="entry === 'users'">
          <UserList class="mb-5" ref="userList" />

          <h2>{{ $t('labels.csvImport') }}</h2>
          <CSVImport
            class="mb-5"
            endpoint="admin/user/bulk"
            :transformers="[
              { path: 'projects.assigned', key: 'identifier', array: $root.projects },
              { path: 'settings.organisation', key: 'name', array: $root.organisations },
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
            @imported=";($refs.userList as any).getUsers()" />
          <h2>{{ $t('labels.mergeUsers') }}</h2>
          <UserMerge />
        </template>
        <template v-else-if="entry === 'projects'">
          <ProjectList class="mb-5" ref="projectList" />
          <h2>{{ $t('labels.csvImport') }}</h2>
          <CSVImport
            class="mb-5"
            endpoint="admin/project/bulk"
            :transformers="[{ path: 'organisation', key: 'name', array: $root.organisations }]"
            :template-fields="['identifier', 'name', 'organisation', 'budget.amount']"
            @imported=";($refs.projectList as any).getProjects()" />
        </template>

        <OrganisationList v-else-if="entry === 'organisations'" />
        <CountryList v-else-if="entry === 'countries'" />
        <CurrencyList v-else-if="entry === 'currencies'" />
        <HealthInsuranceList v-else-if="entry === 'healthInsurances'" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import ConnectionSettingsForm from './elements/ConnectionSettingsForm.vue'
import CountryList from './elements/CountryList.vue'
import CSVImport from './elements/CSVImport.vue'
import CurrencyList from './elements/CurrencyList.vue'
import HealthInsuranceList from './elements/HealthInsuranceList.vue'
import OrganisationList from './elements/OrganisationList.vue'
import ProjectList from './elements/ProjectList.vue'
import SettingsForm from './elements/SettingsForm.vue'
import UserList from './elements/UserList.vue'
import UserMerge from './elements/UserMerge.vue'

const entries = [
  'users',
  'projects',
  'organisations',
  'countries',
  'currencies',
  'healthInsurances',
  'settings',
  'connectionSettings'
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
    ConnectionSettingsForm
  },
  data() {
    return {
      entries,
      entry: 'users' as (typeof entries)[number]
    }
  },
  props: [],

  async created() {
    await this.$root.load()
  }
})
</script>

<style></style>
