<template>
  <div :class="APP_DATA && APP_DATA.organisations.length > 1 ? 'input-group' : ''">
    <ProjectsOfOrganisationSelector
      v-model="projects"
      :class="'col-' + orgSelectSplit"
      :updateUserOrg="updateUserOrg"
      :disabled="disabled"
      load-projects-on-init></ProjectsOfOrganisationSelector>

    <v-select
      v-if="projects"
      :options="projects"
      :modelValue="typeof modelValue === 'object' ? modelValue : null"
      :placeholder="$t('labels.project')"
      @update:modelValue="(v: ProjectSimple) => $emit('update:modelValue', v)"
      :filter="filter"
      :getOptionKey="(option: ProjectSimple) => option._id"
      :getOptionLabel="(option: ProjectSimple) => option.identifier"
      :disabled="disabled"
      :class="APP_DATA && APP_DATA.organisations.length > 1 ? 'col-' + (12 - orgSelectSplit) : ''">
      <template #option="{ identifier, name }: Project">
        <span>{{ identifier + (name ? ' ' + name : '') }}</span>
      </template>
      <template #selected-option="{ identifier, name }: Project">
        <span>{{ identifier + (name ? ' ' + name : '') }}</span>
      </template>
      <template v-if="required" #search="{ attributes, events }">
        <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
      </template>
    </v-select>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { Project, ProjectSimple } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import ProjectsOfOrganisationSelector from '@/components/elements/ProjectsOfOrganisationSelector.vue'

export default defineComponent({
  name: 'ProjectSelector',
  data() {
    return {
      projects: [] as ProjectSimple[],
      APP_DATA: APP_LOADER.data
    }
  },
  components: { ProjectsOfOrganisationSelector },
  props: {
    modelValue: { type: Object as PropType<ProjectSimple> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    updateUserOrg: { type: Boolean, default: false },
    orgSelectSplit: { type: Number as PropType<3 | 4 | 5 | 6>, default: 3 }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: (ProjectSimple | Project)[], search: string): ProjectSimple[] {
      return options.filter((option) => {
        const identifier = option.identifier.toLowerCase().indexOf(search.toLowerCase()) > -1
        if (identifier) {
          return true
        }
        const fullProjectObject = option as Project
        return fullProjectObject.name && fullProjectObject.name.toLowerCase().indexOf(search.toLowerCase()) > -1
      })
    }
  },
  async beforeMount() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
