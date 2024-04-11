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
        <SettingsForm v-if="entry ==='settings'"></SettingsForm>
        <UserList v-else-if="entry === 'users'"</UserList>
        <OrganisationList v-else-if="entry === 'organisations'"</OrganisationList>
        <ProjectList v-else-if="entry === 'projects'"</ProjectList>

      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import OrganisationList from './elements/OrganisationList.vue'
import SettingsForm from './elements/SettingsForm.vue'
import UserList from './elements/UserList.vue'
import ProjectList from './elements/ProjectList.vue'
import ModelsForm from './forms/ModelsForm.vue'

const entries = ['users', 'organisations', 'projects', 'countries', 'currencies', 'healthInsurances', 'settings'] as const

export default defineComponent({
  name: 'SettingsPage',
  components: { UserList, ModelsForm, SettingsForm , OrganisationList, ProjectList},
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
