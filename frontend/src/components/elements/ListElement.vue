<template>
  <Vue3EasyDataTable
    :rows-items="rowsItems"
    v-model:server-options="serverOptions"
    :items-selected="itemsSelected"
    @update:items-selected="(s: Item[]) => emits('update:itemsSelected', s)"
    :server-items-length="serverItemsLength"
    :loading="loading"
    :items="items"
    :headers="headers"
    :sort-by="sortBy"
    :sort-type="sortType"
    alternating
    :preventContextMenuRow="false"
    body-item-class-name="text-truncate">
    <!-- Standard-Slot weiterleiten -->
    <template v-for="(_, slot) in $slots" v-slot:[slot]="scope">
      <slot :name="slot" v-bind="scope"></slot>
    </template>
  </Vue3EasyDataTable>
</template>

<script lang="ts" setup>
import { PropType, ref, watch } from 'vue'
import type { Header, Item, ServerOptions, SortType } from 'vue3-easy-data-table'
import Vue3EasyDataTable from 'vue3-easy-data-table'
import { Base64 } from '@/../../common/scripts.js'
import API from '@/api.js'
import 'vue3-easy-data-table/dist/style.css'

import '@/vue3-easy-data-table.css'

export type Filter = {
  [key: string]:
    | string
    | number
    | undefined
    | null
    | { $regex: string | undefined; $options: string }
    | { $in: Array<unknown> | [undefined] | [null] }
    | { $gt: Date | string | number | undefined }
    | { $gte: Date | string | number | undefined }
    | { $lt: Date | string | number | undefined }
}
const props = defineProps({
  endpoint: { type: String, required: true },
  columnsToHide: { type: Array as PropType<string[]>, default: () => [] },
  headers: { type: Array as PropType<Header[]>, required: true },
  filter: { type: Object as PropType<Filter>, required: true },
  params: { type: Object, default: () => ({}) },
  rowsItems: { type: Array as PropType<number[]>, default: () => [5, 15, 25] },
  rowsPerPage: { type: Number, default: 5 },
  sortBy: { type: String },
  sortType: { type: String as PropType<SortType>, default: 'asc' },
  itemsSelected: { type: Array as PropType<Item[]> }
})

const emits = defineEmits<{ loaded: []; 'update:itemsSelected': [Item[]] }>()

for (const columnToHide of props.columnsToHide) {
  for (let i = 0; i < props.headers.length; i++) {
    if (props.headers[i].value === columnToHide) {
      props.headers.splice(i, 1)
      break
    }
  }
}

const items = ref<Item[]>([])
const loading = ref(false)
const serverItemsLength = ref(0)
const serverOptions = ref<ServerOptions>({ page: 1, rowsPerPage: props.rowsPerPage, sortBy: props.sortBy, sortType: props.sortType })

let oldFilterValue = ''
const loadFromServer = async () => {
  loading.value = true

  const params = Object.assign({}, props.params, { page: serverOptions.value.page, limit: serverOptions.value.rowsPerPage })

  if (serverOptions.value.sortBy && serverOptions.value.sortType && typeof serverOptions.value.sortBy === 'string') {
    const sortObj: Record<string, SortType | SortType[]> = {}
    sortObj[serverOptions.value.sortBy] = serverOptions.value.sortType
    params.sortJSON = Base64.encode(JSON.stringify(sortObj))
  }
  const filter = prepareFilter(props.filter)
  if (filter && Object.keys(filter).length > 0) {
    params.filterJSON = Base64.encode(JSON.stringify(filter))
  }

  const result = (await API.getter<Item[]>(props.endpoint, params)).ok
  if (result) {
    items.value = result.data
    serverItemsLength.value = result.meta.count
  } else {
    items.value = []
    serverItemsLength.value = 0
  }
  loading.value = false
  emits('loaded')
}
const prepareFilter = (filter: Filter) => {
  const filterCopy: Filter = JSON.parse(JSON.stringify(filter))
  for (const filterKey in filterCopy) {
    if (filterCopy[filterKey] === null || filterCopy[filterKey] === undefined) {
      delete filterCopy[filterKey]
    } else if (typeof filterCopy[filterKey] === 'object') {
      if (Object.keys(filterCopy[filterKey]).length === 0) {
        delete filterCopy[filterKey]
      } else if ('$options' in filterCopy[filterKey] && !filterCopy[filterKey].$regex) {
        delete filterCopy[filterKey]
      } else if (
        '$in' in filterCopy[filterKey] &&
        (filterCopy[filterKey].$in.length === 0 ||
          (filterCopy[filterKey].$in.length === 1 && (filterCopy[filterKey].$in[0] === undefined || filterCopy[filterKey].$in[0] === null)))
      ) {
        delete filterCopy[filterKey]
      }
    }
  }
  return filterCopy
}

// initial load
loadFromServer()

watch(
  serverOptions,
  () => {
    loadFromServer()
  },
  { deep: true }
)
watch(
  props.filter,
  (value) => {
    const preparedFilter = prepareFilter(value)
    const filterJSON = JSON.stringify(preparedFilter)
    if (oldFilterValue !== filterJSON) {
      oldFilterValue = filterJSON
      loadFromServer()
    }
  },
  { deep: true }
)
defineExpose({ loadFromServer })
</script>

<style>
tbody.vue3-easy-data-table__body td {
  max-width: 150px;
}
</style>
