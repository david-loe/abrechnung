<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="currency" :filter="filter" :headers="headers" dbKeyPrefix="admin">
      <template #header-name="header">
        <div class="filter-column">
          {{ t(header.text) }}
          <span class="clickable" @click="clickFilter(nameFilterKey)">
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
          {{ t(header.text) }}
          <span class="clickable" @click="(e) => clickFilter('_id', e)">
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
      <template #item-buttons="currency">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(currency)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteCurrency(currency)">
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
        v-model="currencyToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postCurrency(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.currency') }) }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { Currency } from 'abrechnung-common/types.js'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import API from '@/api.js'
import ListElement, { Filter } from '@/components/elements/ListElement.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const headers: Header[] = [
  { text: 'labels.name', value: 'name' },
  { text: 'labels.code', value: '_id' },
  { text: 'labels.symbol', value: 'symbol' },
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

function clickFilter(header: keyof typeof showFilter.value, event?: MouseEvent) {
  event?.stopPropagation()
  if (showFilter.value[header]) {
    showFilter.value[header] = false
    filter.value[header] = getEmptyFilter()[header]
  } else {
    showFilter.value[header] = true
  }
}

const currencyToEdit: Ref<Currency | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(currency?: Currency) {
  currencyToEdit.value = currency
  _showForm.value = true
}
async function postCurrency(currency: Currency) {
  const result = await API.setter<Currency>('admin/currency', currency)
  if (result.ok) {
    _showForm.value = false
    currencyToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadRequired('currency')
  }
}
async function deleteCurrency(currency: Currency) {
  const result = await API.deleter('admin/currency', { _id: currency._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadRequired('currency')
  }
}

const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/currency/form')).ok?.data, {
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
