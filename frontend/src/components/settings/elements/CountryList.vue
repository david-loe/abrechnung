<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="country" :filter="filter" :headers="headers">
      <template #header-name="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter(nameFilterKey)">
            <i v-if="showFilter[nameFilterKey]" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter[nameFilterKey]" @click.stop>
            <input type="text" class="form-control" v-model="(filter[nameFilterKey] as any).$regex" />
          </div>
        </div>
      </template>

      <template #header-_id="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="(e) => clickFilter('_id', e)">
            <i v-if="showFilter._id" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter._id" @click.stop>
            <input type="text" class="form-control" v-model="(filter._id as any).$regex" style="max-width: 80px" />
          </div>
        </div>
      </template>
      <template #item-name="{ name }">
        {{ name[$i18n.locale] }}
      </template>

      <template #item-buttons="country">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(country)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteCountry(country)">
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
        v-model="countryToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postCountry(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.country') }) }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import { Country } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import ListElement, { Filter } from '@/components/elements/ListElement.vue'

const { t } = useI18n()

const headers: Header[] = [
  { text: t('labels.name'), value: 'name' },
  { text: t('labels.code'), value: '_id' },
  { text: t('labels.flag'), value: 'flag' },
  { text: t('labels.currency'), value: 'currency' },
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

const nameFilterKey = `name.${APP_DATA.value?.user.settings.language}`

const getEmptyFilter = () => {
  const emptyFilter: Filter = { _id: { $regex: undefined, $options: 'i' } }
  emptyFilter[nameFilterKey] = { $regex: undefined, $options: 'i' }
  return emptyFilter
}

const filter = ref(getEmptyFilter())

const showFilter = ref({ _id: false } as { [key: string]: boolean })
showFilter.value[nameFilterKey] = false

function clickFilter(header: string, event?: MouseEvent) {
  event?.stopPropagation()
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}

const countryToEdit: Ref<Country | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(country?: Country) {
  countryToEdit.value = country
  _showForm.value = true
}
async function postCountry(country: Country) {
  const result = await API.setter<Country>('admin/country', country)
  if (result.ok) {
    _showForm.value = false
    countryToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadRequired('country')
  }
}
async function deleteCountry(country: Country) {
  const result = await API.deleter('admin/country', { _id: country._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadRequired('country')
  }
}
const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/country/form')).ok?.data, {
  buttons: {
    type: 'group',
    schema: {
      submit: { type: 'button', submits: true, buttonLabel: t('labels.save'), full: true, columns: { container: 6 } },
      reset: { type: 'button', resets: true, buttonLabel: t('labels.cancel'), columns: { container: 6 }, secondary: true }
    }
  }
})
</script>

<style></style>
