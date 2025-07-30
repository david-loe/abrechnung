<template>
  <div class="table-wrapper" :class="{ 'settings-open': showSettings }">
    <div v-if="USE_DB_SETTINGS" class="overlay">
      <div v-if="!showSettings" class="settings-icon">
        <i class="bi bi-gear m-1" @click="showSettings = true" style="cursor: pointer"></i>
      </div>
      <div v-else class="d-flex align-items-center">
        <ArrowSortableList v-model="columnOrder" :labelFn="(c: {text: string, value: string}) => t(c.text)"></ArrowSortableList>
        <i class="bi bi-check-lg m-2 text-success" :title="t('labels.save')" @click="applyOrder" style="cursor: pointer"></i>
        <i class="bi bi-arrow-counterclockwise m-2 text-danger" @click="resetOrder" style="cursor: pointer"></i>
      </div>
    </div>
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
      body-item-class-name="text-truncate"
      :style="{ filter: showSettings ? 'blur(3px)' : 'none', transition: 'filter 0.2s ease-in-out' }">
      <template #header="header">
        {{ t(header.text) }}
      </template>
      <!-- Standard-Slot weiterleiten -->
      <template v-for="(_, slot) in $slots" v-slot:[slot]="scope">
        <slot :name="slot" v-bind="scope"></slot>
      </template>
    </Vue3EasyDataTable>
  </div>
</template>

<script lang="ts" setup>
import { PropType, ref, watch } from 'vue'
import type { Header, Item, ServerOptions, SortType } from 'vue3-easy-data-table'
import Vue3EasyDataTable from 'vue3-easy-data-table'
import { Base64 } from '@/../../common/scripts.js'
import API from '@/api.js'
import 'vue3-easy-data-table/dist/style.css'
import { useI18n } from 'vue-i18n'
import ArrowSortableList from '@/components/elements/ArrowSortableList.vue'
import { deleteFromDB, readFromDB, storeToDB } from '@/indexedDB'

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

const headers = ref(props.headers)
for (const columnToHide of props.columnsToHide) {
  for (let i = 0; i < headers.value.length; i++) {
    if (headers.value[i].value === columnToHide) {
      headers.value.splice(i, 1)
      break
    }
  }
}
const defaultColumnOrder = headers.value.map((h) => ({ value: h.value, text: h.text }))
const USE_DB_SETTINGS = typeof props.dbKeyPrefix === 'string'
const DB_KEY = `${props.dbKeyPrefix}-${props.endpoint}`
const dbColumnOrder = USE_DB_SETTINGS ? await readFromDB('columnOrder', DB_KEY) : undefined
if (dbColumnOrder) {
  orderHeaders(dbColumnOrder)
}
const columnOrder = ref(dbColumnOrder || defaultColumnOrder)
const showSettings = ref(false)

const items = ref<Item[]>([])
const loading = ref(false)
const serverItemsLength = ref(0)
const serverOptions = ref<ServerOptions>({ page: 1, rowsPerPage: props.rowsPerPage, sortBy: props.sortBy, sortType: props.sortType })

// initial load
loadFromServer()

let oldFilterValue = ''
async function loadFromServer() {
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
async function applyOrder() {
  orderHeaders(columnOrder.value)
  showSettings.value = false
  await storeToDB('columnOrder', [...columnOrder.value.map((c) => ({ ...c }))], DB_KEY)
}
async function resetOrder() {
  columnOrder.value = defaultColumnOrder
  orderHeaders(defaultColumnOrder)
  showSettings.value = false
  await deleteFromDB('columnOrder', DB_KEY)
}
function orderHeaders(columnOrder: { value: string; text: string }[]) {
  const orderIndex = columnOrder.reduce(
    (map, c, i) => {
      map[c.value] = i
      return map
    },
    {} as Record<string, number>
  )
  headers.value.sort((a, b) => {
    const orderA = orderIndex[a.value] ?? 99
    const orderB = orderIndex[b.value] ?? 99
    return orderA - orderB
  })
}

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
</script>

<style>
tbody.vue3-easy-data-table__body td {
  max-width: 150px;
}
</style>

<style scoped>
.table-wrapper {
  position: relative; /* für absolutes Positionieren des Icons */
}

/* Das Icon verstecken und sanft einblenden */
.overlay {
  z-index: 10;
  position: absolute;
  top: 1px;
  right: 1px;
  /* Optional: Hintergrundkreis, damit’s besser zu erkennen ist */
  background-color: rgba(var(--bs-body-bg-rgb), 0.8);
  /* line-height: 0; */
}

.settings-icon {
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

/* Beim Hover über den Wrapper Icon einblenden */
.table-wrapper:hover .settings-icon {
  opacity: 1;
}
</style>
