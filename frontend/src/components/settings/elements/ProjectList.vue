<template>
  <div>
    <ListElement class="mb-3" ref="list" :endpoint="endpoint" :filter="filter" :headers="headers" :dbKeyPrefix="dbKeyPrefix">
      <template #header-identifier="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="(e) => clickFilter('identifier', e)">
            <i v-if="showFilter.identifier" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.identifier" @click.stop>
            <input type="text" class="form-control" v-model="(filter.identifier as any).$regex" >
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
            <input type="text" class="form-control" v-model="(filter.name as any).$regex" >
          </div>
        </div>
      </template>

      <template #item-organisation="{ organisation }">{{ getById(organisation, APP_DATA!.organisations)?.name }}</template>
      <template #item-buttons="project">
        <button v-if="createOnly" type="button" class="btn btn-light btn-sm" @click="showForm(project, true)">
          <i class="bi bi-eye"></i>
        </button>
        <template v-else>
          <button type="button" class="btn btn-light btn-sm" @click="showForm(project)"><i class="bi bi-pencil"></i></button>
          <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteProject(project)"><i class="bi bi-trash"></i></button>
        </template>
      </template>
    </ListElement>
    <div v-if="_showForm" class="container">
      <Vueform
        :schema="formSchema"
        v-model="projectToEdit"
        :sync="true"
        :disabled="viewOnly"
        :endpoint="false"
        @submit="(form$: any) => postProject(form$.data)"
        @reset="_showForm = false" />
      <button v-if="viewOnly" type="button" class="btn btn-secondary mt-3" @click="closeForm">{{ t('labels.cancel') }}</button>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">{{ t('labels.addX', { X: t('labels.project') }) }}</button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { Project } from 'abrechnung-common/types.js'
import { getById } from 'abrechnung-common/utils/scripts.js'
import { computed, Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import API from '@/api.js'
import ListElement from '@/components/elements/ListElement.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const props = withDefaults(defineProps<{ endpoint?: string; createOnly?: boolean; dbKeyPrefix?: string }>(), {
  endpoint: 'admin/project',
  createOnly: false,
  dbKeyPrefix: 'admin'
})

const endpoint = computed(() => props.endpoint)
const createOnly = computed(() => props.createOnly)
const dbKeyPrefix = computed(() => props.dbKeyPrefix)
const headers = computed<Header[]>(() => [
  { text: 'labels.identifier', value: 'identifier' },
  { text: 'labels.name', value: 'name' },
  { text: 'labels.organisation', value: 'organisation', sortable: true },
  { text: '', value: 'buttons', width: createOnly.value ? 48 : 80 }
])

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
const viewOnly = ref(false)

function showForm(project?: Project, readOnly = false) {
  projectToEdit.value = project
  viewOnly.value = readOnly
  _showForm.value = true
}
function closeForm() {
  _showForm.value = false
  viewOnly.value = false
  projectToEdit.value = undefined
}
async function postProject(project: Project) {
  if (viewOnly.value) return
  const result = await API.setter<Project>(props.endpoint, project)
  if (result.ok) {
    _showForm.value = false
    projectToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadOptional('project')
  }
}
async function deleteProject(project: Project<string>) {
  const result = await API.deleter(props.endpoint, { _id: project._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadOptional('project')
  }
}

const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>(`${props.endpoint}/form`)).ok?.data, {
  buttons: {
    type: 'group',
    schema: {
      submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } },
      reset: { type: 'button', resets: true, buttonLabel: t('labels.cancel'), columns: { container: 6 }, secondary: true }
    }
  }
})
const readOnlySchema = Object.fromEntries(
  Object.entries(schema).filter(([field]) => field !== 'assignees' && field !== 'supervisors')
)
const formSchema = computed(() => (viewOnly.value ? readOnlySchema : schema))
</script>

<style></style>
