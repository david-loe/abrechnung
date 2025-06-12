<template>
  <select
    v-if="APP_DATA"
    :class="'form-select' + (APP_DATA.organisations.length > 1 ? '' : ' d-none')"
    id="healthCareCostFormProject"
    v-model="selectedOrg"
    :disabled="disabled"
    :required="required"
    @change="onChange">
    <option v-for="organisation in APP_DATA.organisations" :value="organisation" :key="organisation._id">
      {{ organisation.name }}
    </option>
  </select>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { getById } from '@/../../common/scripts.js'
import { OrganisationSimple, ProjectSimple } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'

const props = defineProps<{
  modelValue: ProjectSimple[] | string[] | [undefined] | [null]
  required?: boolean
  disabled?: boolean
  updateUserOrg?: boolean
  reduceToId?: boolean
  loadProjectsOnInit?: boolean
}>()

// Emits definieren
const emit = defineEmits<{ 'update:modelValue': [projects: ProjectSimple[] | string[]] }>()

// Reaktive Variablen
const selectedOrg = ref<OrganisationSimple | null>(null)
const APP_DATA = APP_LOADER.data

function getProjects(orgaId?: string) {
  const projects: ProjectSimple[] = []
  if (APP_DATA.value) {
    // Projekte aus den zugewiesenen Projekten des Users
    for (const project of APP_DATA.value.user.projects.assigned) {
      if (!orgaId || project.organisation === orgaId) {
        projects.push(project)
      }
    }
    // Weitere Projekte aus APP_DATA.projects, falls noch nicht enthalten
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
  // Wenn reduceToId true ist, nur die IDs der Projekte zurückgeben
  if (props.reduceToId) {
    const projectIds = projects.map((project) => project._id)
    emit('update:modelValue', projectIds)
    return
  }
  // Andernfalls die vollständigen Projektobjekte zurückgeben

  emit('update:modelValue', projects)
}

function changeOrganisation(newOrga: OrganisationSimple) {
  getProjects(newOrga._id)
  if (props.updateUserOrg && APP_DATA.value) {
    APP_DATA.value.user.settings.organisation = newOrga
    API.setter('user/settings', APP_DATA.value.user.settings, {}, false)
  }
}

function onChange() {
  if (selectedOrg.value) {
    changeOrganisation(selectedOrg.value)
  }
}

onMounted(async () => {
  await APP_LOADER.loadData()
  if (props.modelValue && props.modelValue.length > 0 && props.modelValue[0]) {
    let project: ProjectSimple | null = null
    if (typeof props.modelValue[0] === 'object') {
      project = props.modelValue[0]
    }
    if (typeof props.modelValue[0] === 'string' && APP_DATA.value?.projects) {
      project = getById(props.modelValue[0], APP_DATA.value.projects)
    }
    if (project && APP_DATA.value) {
      selectedOrg.value = getById(project.organisation, APP_DATA.value.organisations)
      return
    }
  }
  if (props.updateUserOrg && APP_DATA.value?.user.settings.organisation) {
    selectedOrg.value = APP_DATA.value.user.settings.organisation
  }

  if (props.loadProjectsOnInit) {
    getProjects(selectedOrg.value?._id)
  }
})
</script>

<style></style>
