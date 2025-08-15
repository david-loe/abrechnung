<template>
  <OrganisationSelector
    v-if="APP_DATA"
    :class="'form-select' + (APP_DATA.organisations.length > 1 ? '' : ' d-none')"
    id="healthCareCostFormProject"
    :modelValue="initialOrg"
    :disabled="disabled"
    :required="required"
    @update:modelValue="(o) => getProjects(o._id)">
    <option v-for="organisation in APP_DATA.organisations" :value="organisation" :key="organisation._id">
      {{ organisation.name }}
    </option>
  </OrganisationSelector>
</template>

<script lang="ts" setup>
import { getById } from 'abrechnung-common/scripts.js'
import { OrganisationSimple, ProjectSimple } from 'abrechnung-common/types.js'
import { onMounted, ref } from 'vue'
import APP_LOADER from '@/appData.js'
import OrganisationSelector from '@/components/elements/OrganisationSelector.vue'

const props = defineProps<{
  modelValue: ProjectSimple<string>[] | string[] | [undefined] | [null]
  required?: boolean
  disabled?: boolean
  updateUserOrg?: boolean
  reduceToId?: boolean
  loadProjectsOnInit?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [projects: ProjectSimple[] | string[]] }>()

const initialOrg = ref<OrganisationSimple<string> | null>(null)
const APP_DATA = APP_LOADER.data

function getProjects(orgaId?: string) {
  const projects: ProjectSimple<string>[] = []
  if (APP_DATA.value) {
    for (const project of APP_DATA.value.user.projects.assigned) {
      if (!orgaId || project.organisation === orgaId) {
        projects.push(project)
      }
    }

    if (APP_DATA.value.projects) {
      for (const project of APP_DATA.value.projects) {
        let alreadyIn = false
        for (const userProject of APP_DATA.value.user.projects.assigned) {
          if (project._id === userProject._id) {
            alreadyIn = true
            break
          }
        }
        if (!alreadyIn) {
          if (!orgaId || project.organisation === orgaId) {
            projects.push(project)
          }
        }
      }
    }
  }

  if (props.reduceToId) {
    const projectIds = projects.map((project) => project._id)
    emit('update:modelValue', projectIds)
    return
  }

  emit('update:modelValue', projects)
}

onMounted(async () => {
  await APP_LOADER.loadData()
  if (props.modelValue && props.modelValue.length > 0 && props.modelValue[0]) {
    let project: ProjectSimple<string> | null = null
    if (typeof props.modelValue[0] === 'object') {
      project = props.modelValue[0]
    }
    if (typeof props.modelValue[0] === 'string' && APP_DATA.value?.projects) {
      project = getById(props.modelValue[0], APP_DATA.value.projects)
    }
    if (project && APP_DATA.value) {
      initialOrg.value = getById(project.organisation, APP_DATA.value.organisations)
      return
    }
  }
  if (props.updateUserOrg && APP_DATA.value?.user.settings.organisation) {
    initialOrg.value = APP_DATA.value.user.settings.organisation
  }

  if (props.loadProjectsOnInit) {
    getProjects(initialOrg.value?._id)
  }
})
</script>

<style></style>
