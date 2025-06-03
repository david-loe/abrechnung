<template>
  <div>
    <ListElement class="mb-3" ref="list" endpoint="category" :filter="filter" :headers="headers">
      <template #header-name="header">
        <div class="filter-column">
          {{ header.text }}
          <span style="cursor: pointer" @click="(e) => clickFilter('name', e)">
            <i v-if="showFilter.name" class="bi bi-funnel-fill"></i>
            <i v-else class="bi bi-funnel"></i>
          </span>
          <div v-if="showFilter.name">
            <input type="text" class="form-control" v-model="(filter.name as any).$regex" />
          </div>
        </div>
      </template>

      <template #item-name="category">
        <Badge :text="category.name" :style="category.style"></Badge>
      </template>
      <template #item-buttons="category">
        <button type="button" class="btn btn-light btn-sm" @click="showForm(category)">
          <div class="d-none d-md-block">
            <i class="bi bi-pencil"></i>
          </div>
          <i class="bi bi-pencil d-block d-md-none"></i>
        </button>
        <button type="button" class="btn btn-danger btn-sm ms-2" @click="deleteCategory(category)">
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
        v-model="categoryToEdit"
        :sync="true"
        :endpoint="false"
        @submit="(form$: any) => postCategory(form$.data)"
        @reset="_showForm = false"></Vueform>
    </div>
    <button v-else type="button" class="btn btn-secondary" @click="showForm()">
      {{ $t('labels.addX', { X: $t('labels.category') }) }}
    </button>
  </div>
</template>

<script lang="ts" setup>
import { Category } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'
import Badge from '@/components/elements/Badge.vue'
import ListElement from '@/components/elements/ListElement.vue'

import { Ref, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Header } from 'vue3-easy-data-table'

const { t } = useI18n()

const headers: Header[] = [
  { text: t('labels.name'), value: 'name' },
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

const showFilter = ref({
  name: false
})

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
    loadFromServer()
    APP_LOADER.loadRequired('category')
    _showForm.value = false
  }
  categoryToEdit.value = undefined
}
async function deleteCategory(category: Category) {
  const result = await API.deleter('admin/category', { _id: category._id })
  if (result) {
    loadFromServer()
    APP_LOADER.loadRequired('category')
  }
}

const schema = Object.assign({}, (await API.getter<any>('admin/category/form')).ok?.data, {
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
