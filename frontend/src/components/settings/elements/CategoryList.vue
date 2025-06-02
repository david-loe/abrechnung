<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="category" :filter="filter" :headers="headers" dbKeyPrefix="admin">
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

      <template #item-for="category">
        <i
          v-if="APP_DATA && category.for !== 'both'"
          :class="`bi bi-${APP_DATA.displaySettings.reportTypeIcons[getReportTypeFromModelName(category.for)]}`"></i>
      </template>
      <template #item-name="category">
        <Badge :text="category.name" :style="category.style" />
      </template>
      <template #item-ledgerAccount="{ ledgerAccount }">
        <template v-if="APP_DATA?.ledgerAccounts">{{ getById(ledgerAccount, APP_DATA.ledgerAccounts)?.identifier }}</template>
      </template>

      <template #item-buttons="category">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(category)"><i class="bi bi-pencil"></i></button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteCategory(category)"><i class="bi bi-trash"></i></button>
      </template>
    </ListElement>
    <div v-if="_showForm" class="container">
      <Vueform
        :schema="schema"
        v-model="categoryToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postCategory(form$.data)"
        @reset="_showForm = false" />
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">{{ t('labels.addX', { X: t('labels.category') }) }}</button>
  </div>
</template>

<script lang="ts" setup>
import { VueformSchema } from '@vueform/vueform'
import { getById } from 'abrechnung-common/utils/scripts.js'
import { Category, getReportTypeFromModelName } from 'abrechnung-common/types.js'
import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'
import API from '@/api.js'
import Badge from '@/components/elements/Badge.vue'
import ListElement from '@/components/elements/ListElement.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const headers: Header[] = [
  { text: '', value: 'for', width: 20 },
  { text: 'labels.name', value: 'name' },
  { text: 'labels.ledgerAccount', value: 'ledgerAccount' },
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

const categoryToEdit: Ref<Category | undefined> = ref(undefined)
const _showForm = ref(false)

function showForm(category?: Category) {
  categoryToEdit.value = category
  _showForm.value = true
}
async function postCategory(category: Category) {
  const result = await API.setter<Category>('admin/category', category)
  if (result.ok) {
    _showForm.value = false
    categoryToEdit.value = undefined
    loadFromServer()
    APP_LOADER.loadRequired('category')
  }
}
async function deleteCategory(category: Category<string>) {
  const result = await API.deleter('admin/category', { _id: category._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadRequired('category')
  }
}

const schema = Object.assign({}, (await API.getter<{ [key: string]: VueformSchema }>('admin/category/form')).ok?.data, {
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
