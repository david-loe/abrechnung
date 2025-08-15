<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="admin/organisation" :filter="filter" :headers="headers" dbKeyPrefix="admin">
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

      <template #item-buttons="organisation">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(organisation)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteOrganisation(organisation)">
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
        v-model="organisationToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postOrganisation(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.organisation') }) }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { Organisation } from 'abrechnung-common/types.js'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ListElement from '@/components/elements/ListElement.vue'

const { t } = useI18n()

const headers: Header[] = [
  { text: 'labels.name', value: 'name' },
  { text: 'labels.reportEmail', value: 'reportEmail' },
  { text: 'labels.website', value: 'website' },
  { text: '', value: 'buttons', width: 80 }
]

const list = useTemplateRef('list')
async function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
  }
}
defineExpose({ loadFromServer })

const getEmptyFilter = () => ({ name: { $regex: undefined, $options: 'i' } })

const filter = ref(getEmptyFilter())

const showFilter = ref({ name: false })

function clickFilter(header: keyof typeof showFilter.value, event?: MouseEvent) {
  event?.stopPropagation()
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}

const organisationToEdit: Ref<Organisation | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(organisation?: Organisation) {
  organisationToEdit.value = organisation
  _showForm.value = true
}
async function postOrganisation(organisation: Organisation) {
  let headers: Record<string, string> = {}
  if (organisation.logo) {
    headers = { 'Content-Type': 'multipart/form-data' }
  }
  const result = await API.setter<Organisation>('admin/organisation', organisation, { headers })
  if (result.ok) {
    _showForm.value = false
    organisationToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadRequired('organisation')
  }
}
async function deleteOrganisation(organisation: Organisation<string>) {
  const result = await API.deleter('admin/organisation', { _id: organisation._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadRequired('organisation')
  }
}

const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/organisation/form')).ok?.data, {
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
