<template>
  <div :class="APP_DATA && APP_DATA.organisations.length > 1 ? 'input-group' : ''">
    <ProjectsOfOrganisationSelector
      v-model="projects"
      :class="'col-' + props.orgSelectSplit"
      :updateUserOrg="props.updateUserOrg"
      :disabled="props.disabled"
      load-projects-on-init />

    <v-select
      v-if="projects"
      :options="projects"
      :modelValue="props.modelValue === undefined ? null : props.modelValue"
      :placeholder="t('labels.project')"
      @update:modelValue="(v: ProjectSimple<string>) => emit('update:modelValue', v)"
      :filter="filter"
      :getOptionKey="(option: ProjectSimple) => option._id"
      :getOptionLabel="(option: ProjectSimple) => option.identifier"
      :disabled="props.disabled"
      :class="APP_DATA && APP_DATA.organisations.length > 1 ? 'col-' + (12 - props.orgSelectSplit) : ''">
      <template #option="{ identifier, name }: Project">
        <span>{{ identifier + (name ? ' ' + name : '') }}</span>
      </template>
      <template #selected-option="{ identifier, name }: Project">
        <span>{{ identifier + (name ? ' ' + name : '') }}</span>
      </template>
      <template v-if="props.required" #search="{ attributes, events }">
        <input class="vs__search" :required="!props.modelValue" v-bind="attributes" v-on="events" >
      </template>
    </v-select>
  </div>
</template>

<script lang="ts" setup>
import { Project, ProjectSimple } from 'abrechnung-common/types.js'
import { PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'
import ProjectsOfOrganisationSelector from './ProjectsOfOrganisationSelector.vue'

const { t } = useI18n()

const projects = ref([] as ProjectSimple<string>[])
const APP_DATA = APP_LOADER.data

const props = defineProps({
  modelValue: { type: Object as PropType<ProjectSimple<string> | null> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  updateUserOrg: { type: Boolean, default: false },
  orgSelectSplit: { type: Number as PropType<3 | 4 | 5 | 6>, default: 3 }
})
const emit = defineEmits<{ 'update:modelValue': [ProjectSimple<string>] }>()

function filter(options: (ProjectSimple<string> | Project<string>)[], search: string): ProjectSimple<string>[] {
  return options.filter((option) => {
    const identifier = option.identifier.toLowerCase().indexOf(search.toLowerCase()) > -1
    if (identifier) {
      return true
    }
    const fullProjectObject = option as Project
    return fullProjectObject.name && fullProjectObject.name.toLowerCase().indexOf(search.toLowerCase()) > -1
  })
}

await APP_LOADER.loadData()
</script>

<style></style>
