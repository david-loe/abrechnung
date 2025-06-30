<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="healthInsurance" :filter="filter" :headers="headers">
      <template #header-name="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="(e) => clickFilter('name', e)">
            <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.name" @click.stop>
            <input type="text" class="form-control" v-model="(filter.name as any).$regex" />
          </div>
        </div>
      </template>

      <template #header-email="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="(e) => clickFilter('email', e)">
            <i v-if="showFilter.email" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.email" @click.stop>
            <input type="text" class="form-control" v-model="(filter.email as any).$regex" />
          </div>
        </div>
      </template>

      <template #item-buttons="healthInsurance">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(healthInsurance)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteHealthInsurance(healthInsurance)">
          <div class="d-none d-md-block">
            <i class="bi bi-trash"></i>
          </div>
          <i class="bi bi-trash d-block d-md-none"></i>
        </button>
      </template>
    </ListElement>
    <div v-if="_showForm" class="container" style="max-width: 650px">
      <Vueform
        :schema="schema"
        v-model="healthInsuranceToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postHealthInsurance(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.healthInsurance') }) }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import { HealthInsurance } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ListElement from '@/components/elements/ListElement.vue'

const { t } = useI18n()

const headers: Header[] = [
  { text: t('labels.name'), value: 'name' },
  { text: t('labels.email'), value: 'email' },
  { text: '', value: 'buttons', width: 80 }
]

const list = useTemplateRef('list')
async function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
  }
}
defineExpose({ loadFromServer })

const getEmptyFilter = () => ({ name: { $regex: undefined, $options: 'i' }, email: { $regex: undefined, $options: 'i' } })

const filter = ref(getEmptyFilter())

const showFilter = ref({ name: false, email: false })

function clickFilter(header: keyof typeof showFilter.value, event?: MouseEvent) {
  event?.stopPropagation()
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}

const healthInsuranceToEdit: Ref<HealthInsurance | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(healthInsurance?: HealthInsurance) {
  healthInsuranceToEdit.value = healthInsurance
  _showForm.value = true
}
async function postHealthInsurance(healthInsurance: HealthInsurance) {
  const result = await API.setter<HealthInsurance>('admin/healthInsurance', healthInsurance)
  if (result.ok) {
    _showForm.value = false
    healthInsuranceToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadRequired('healthInsurance')
  }
}
async function deleteHealthInsurance(healthInsurance: HealthInsurance) {
  const result = await API.deleter('admin/healthInsurance', { _id: healthInsurance._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadRequired('healthInsurance')
  }
}

const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/healthInsurance/form')).ok?.data, {
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
