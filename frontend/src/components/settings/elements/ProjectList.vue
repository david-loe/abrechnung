<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="admin/project" :filter="filter" :headers="headers" dbKeyPrefix="admin">
      <template #header-identifier="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="(e) => clickFilter('identifier', e)">
            <i v-if="showFilter.identifier" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.identifier" @click.stop>
            <input type="text" class="form-control" v-model="(filter.identifier as any).$regex" />
          </div>
        </div>
      </template>
      <template #header-name="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="(e) => clickFilter('name', e)">
            <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.name" @click.stop>
            <input type="text" class="form-control" v-model="(filter.name as any).$regex" />
          </div>
        </div>
      </template>

      <template #item-organisation="{ organisation }">
        {{ getById(organisation, APP_DATA!.organisations)?.name }}
      </template>
      <template #item-buttons="project">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(project)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteProject(project)">
          <div class="d-none d-md-block">
            <i class="bi bi-trash"></i>
          </div>
          <i class="bi bi-trash d-block d-md-none"></i>
        </button>
      </template>
    </ListElement>
    <div v-if="_showForm" class="container">
      <Vueform
        :schema="schema"
        v-model="projectToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postProject(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.project') }) }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { Project } from 'abrechnung-common/types.js'
import { getById } from 'abrechnung-common/utils/scripts.js'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ListElement from '@/components/elements/ListElement.vue'

const { t } = useI18n()

const headers: Header[] = [
  { text: 'labels.identifier', value: 'identifier' },
  { text: 'labels.name', value: 'name' },
  { text: 'labels.organisation', value: 'organisation', sortable: true },
  { text: '', value: 'buttons', width: 80 }
]

const list = useTemplateRef('list')
async function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
  }
}
defineExpose({ loadFromServer })

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

const getEmptyFilter = () => ({ name: { $regex: undefined, $options: 'i' }, identifier: { $regex: undefined, $options: 'i' } })

const filter = ref(getEmptyFilter())

const showFilter = ref({ name: false, identifier: false })

function clickFilter(header: keyof typeof showFilter.value, event?: MouseEvent) {
  event?.stopPropagation()
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}

const projectToEdit: Ref<Project | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(project?: Project) {
  projectToEdit.value = project
  _showForm.value = true
}
async function postProject(project: Project) {
  const result = await API.setter<Project>('admin/project', project)
  if (result.ok) {
    _showForm.value = false
    projectToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadOptional('project')
  }
}
async function deleteProject(project: Project<string>) {
  const result = await API.deleter('admin/project', { _id: project._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadOptional('project')
  }
}

const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/project/form')).ok?.data, {
  buttons: {
    type: 'group',
    schema: {
      submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } },
      reset: { type: 'button', resets: true, buttonLabel: t('labels.cancel'), columns: { container: 6 }, secondary: true }
    }
  },
  _id: { type: 'hidden', meta: true }
})
</script>

<style></style>
