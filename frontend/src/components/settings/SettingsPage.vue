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
        <template v-else-if="entry === 'users'">
          <CSVImport
            endpoint="admin/user/bulk"
            :transformers="[
              { path: 'settings.projects', key: 'identifier', array: $root.projects },
              { path: 'settings.organisation', key: 'name', array: $root.organisations }
            ]"
            :template-fields="[
              'name.givenName',
              'name.familyName',
              'email',
              'fk.magiclogin',
              'loseAccessAt',
              'settings.projects',
              'settings.organisation'
            ]" />
          <UserList class="mb-5" />
          <h2>{{ $t('labels.mergeUsers') }}</h2>
          <UserMerge />
        </template>
        <ProjectList v-else-if="entry === 'projects'" />
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
import CountryList from './elements/CountryList.vue'
import CSVImport from './elements/CSVImport.vue'
import CurrencyList from './elements/CurrencyList.vue'
import HealthInsuranceList from './elements/HealthInsuranceList.vue'
import OrganisationList from './elements/OrganisationList.vue'
import ProjectList from './elements/ProjectList.vue'
import SettingsForm from './elements/SettingsForm.vue'
import UserList from './elements/UserList.vue'
import UserMerge from './elements/UserMerge.vue'

const entries = ['users', 'projects', 'organisations', 'countries', 'currencies', 'healthInsurances', 'settings'] as const

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
    CSVImport
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
