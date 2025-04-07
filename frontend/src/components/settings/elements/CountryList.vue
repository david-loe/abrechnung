<template>
  <div>
    <ListElement
      class="mb-3"
      ref="list"
      endpoint="country"
      :filter="filter"
      :headers="headers"
      :params="{ additionalFields: ['lumpSums', 'lumpSumsFrom'] }">
      <template #header-name="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter(nameFilterKey)">
            <i v-if="showFilter[nameFilterKey]" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter[nameFilterKey]">
            <input type="text" class="form-control" v-model="(filter[nameFilterKey] as any).$regex" />
          </div>
        </div>
      </template>

      <template #header-_id="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="clickFilter('_id')">
            <i v-if="showFilter._id" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter._id">
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
    <div v-if="_showForm" class="container" style="max-width: 650px">
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
import { Country } from '@/../../common/types'
import API from '@/api'
import APP_LOADER from '@/appData'
import ListElement, { Filter } from '@/components/elements/ListElement.vue'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'

const { t } = useI18n()
await APP_LOADER.loadData()

const headers: Header[] = [
  { text: t('labels.name'), value: 'name' },
  { text: t('labels.code'), value: '_id' },
  { text: t('labels.flag'), value: 'flag' },
  { text: t('labels.currency'), value: 'currency' },
  { text: '', value: 'buttons', width: 80 }
]

const APP_DATA = APP_LOADER.data

const nameFilterKey = 'name.' + APP_DATA.value!.user.settings.language

const getEmptyFilter = () => {
  const emptyFilter: Filter = { _id: { $regex: undefined, $options: 'i' } }
  emptyFilter[nameFilterKey] = { $regex: undefined, $options: 'i' }
  return emptyFilter
}

const filter = ref(getEmptyFilter())

const showFilter = ref({
  _id: false
} as {
  [key: string]: boolean
})
showFilter.value[nameFilterKey] = false

function clickFilter(header: string) {
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}

const list = useTemplateRef('list')
async function loadFromServer() {
  if (list.value) {
    list.value.loadFromServer()
    const rootCountries = (await API.getter<Country[]>('country')).ok?.data
    if (rootCountries && APP_DATA.value) {
      APP_DATA.value.countries = rootCountries
    }
  }
}
defineExpose({ loadFromServer })

let countryToEdit: Ref<Country | undefined> = ref(undefined)
let _showForm = ref(false)

function showForm(country?: Country) {
  countryToEdit.value = country
  _showForm.value = true
}
async function postCountry(country: Country) {
  const result = await API.setter<Country>('admin/country', country)
  if (result.ok) {
    _showForm.value = false
    loadFromServer()
  }
  countryToEdit.value = undefined
}
async function deleteCountry(country: Country) {
  const result = await API.deleter('admin/country', { _id: country._id })
  if (result) {
    loadFromServer()
  }
}
const schema = Object.assign({}, (await API.getter<any>('admin/country/form')).ok?.data, {
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
