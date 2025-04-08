<template>
  <EasyDataTable
    :rows-items="[5, 15, 25]"
    :rows-per-page="5"
    v-model:server-options="serverOptions"
    :server-items-length="serverItemsLength"
    :loading="loading"
    :items="items"
    sort-by="name"
    :headers="headers"
    alternating
    :preventContextMenuRow="false"
    body-item-class-name="text-truncate">
    <!-- Standard-Slot weiterleiten -->
    <template v-for="(_, slot) in $slots" v-slot:[slot]="scope">
      <slot :name="slot" v-bind="scope"></slot>
    </template>
  </EasyDataTable>
</template>

<script lang="ts" setup>
import { Base64 } from '@/../../common/scripts'
import API from '@/api.js'
import { ref, watch } from 'vue'
import type { Header, Item, ServerOptions } from 'vue3-easy-data-table'

export type Filter = {
  [key: string]: string | undefined | null | { $regex: string | undefined; $options: string } | { $in: Array<any> | [undefined] | [null] }
}
const props = defineProps<{
  endpoint: string
  columnsToHide?: string[]
  headers: Header[]
  filter: Filter
  params?: any
}>()

if (props.columnsToHide) {
  for (const columnToHide of props.columnsToHide) {
    for (let i = 0; i < props.headers.length; i++) {
      if (props.headers[i].value === columnToHide) {
        props.headers.splice(i, 1)
        break
      }
    }
  }
}

const items = ref<Item[]>([])
const loading = ref(false)
const serverItemsLength = ref(0)
const serverOptions = ref<ServerOptions>({
  page: 1,
  rowsPerPage: 5
})

let oldFilterValue = ''
const loadFromServer = async () => {
  loading.value = true

  const params = Object.assign({}, props.params || {}, { page: serverOptions.value.page, limit: serverOptions.value.rowsPerPage })

  if (serverOptions.value.sortBy && serverOptions.value.sortType && typeof serverOptions.value.sortBy === 'string') {
    const sortObj = {} as any
    sortObj[serverOptions.value.sortBy] = serverOptions.value.sortType
    params.sortJSON = Base64.encode(JSON.stringify(sortObj))
  }
  const filter = prepareFilter(props.filter)
  if (filter && Object.keys(filter).length > 0) {
    params.filterJSON = Base64.encode(JSON.stringify(filter))
  }

  let result = (await API.getter<any[]>(props.endpoint, params)).ok
  if (result) {
    items.value = result.data
    serverItemsLength.value = result.meta.count
  } else {
    items.value = []
    serverItemsLength.value = 0
  }
  loading.value = false
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
  (value) => {
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
td {
  max-width: 100px;
}
</style>
