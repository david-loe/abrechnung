<template>
  <TableElement
    :columns-to-hide="columnsToHide"
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
    :db-key="dbKey">
    <template #header="header">{{ header.text ? t(header.text) : '' }}</template>
    <!-- Standard-Slot weiterleiten -->
    <template v-for="(_, slot) in $slots" :key="slot" v-slot:[slot]="scope">
      <slot :name="slot" v-bind="scope"></slot>
    </template>
  </TableElement>
</template>

<script lang="ts" setup>
import { Base64 } from 'abrechnung-common/utils/encoding.js'
import { onBeforeUnmount, PropType, ref } from 'vue'
import type { Header, Item, ServerOptions, SortType } from 'vue3-easy-data-table'
import API from '@/api.js'
import '@/vendor/vue3-easy-data-table.css'
import { useI18n } from 'vue-i18n'
import TableElement from '@/components/elements/TableElement.vue'
import { logger } from '@/logger.js'
import { createListRequests, watchListRequests } from './listRequests.js'

import '@/vue3-easy-data-table.css'

const { t } = useI18n()
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
  dbKeyPrefix: { type: String },
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
defineExpose({ loadFromServer })

const dbKey = typeof props.dbKeyPrefix === 'string' ? `${props.dbKeyPrefix}-${props.endpoint}` : undefined

const items = ref<Item[]>([])
const loading = ref(false)
const serverItemsLength = ref(0)
const serverOptions = ref<ServerOptions>({ page: 1, rowsPerPage: props.rowsPerPage, sortBy: props.sortBy, sortType: props.sortType })

const requests = createListRequests({
  request: requestItems,
  apply: (response) => {
    items.value = response.ok?.data ?? []
    serverItemsLength.value = response.ok?.meta.count ?? 0
    emits('loaded')
  },
  setLoading: (value) => {
    loading.value = value
  },
  onError: (error) => logger.error(error)
})

function loadFromServer() {
  return requests.load()
}

async function requestItems(signal: AbortSignal) {
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

  return await API.getter<Item[]>(props.endpoint, params, { signal })
}

function prepareFilter(filter: Filter) {
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

const stopWatching = watchListRequests(serverOptions, () => JSON.stringify(prepareFilter(props.filter)), requests)
onBeforeUnmount(() => {
  stopWatching()
  requests.dispose()
})
void loadFromServer()
</script>

<style></style>
