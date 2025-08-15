<template>
  <div class="table-wrapper" :class="{ 'settings-open': showSettings }">
    <div v-if="USE_DB_SETTINGS" class="overlay">
      <div v-if="!showSettings" class="settings-icon">
        <button type="button" class="btn p-0 m-1" @click="showSettings = true"><i class="bi bi-gear"></i></button>
      </div>
      <div v-else class="d-flex align-items-center">
        <ArrowSortableList
          v-model="columnOrder"
          :labelFn="(c: {text: string, value: string}) => c.text ? t(c.text) : c.value"></ArrowSortableList>
        <button type="button" class="btn p-0 m-2" :title="t('labels.save')" @click="applyOrder">
          <i class="bi bi-check-lg text-success"></i>
        </button>
        <button type="button" class="btn p-0 m-2" @click="resetOrder"><i class="bi bi-arrow-counterclockwise text-danger"></i></button>
      </div>
    </div>
    <Vue3EasyDataTable
      :rows-items="rowsItems"
      :rows-per-page="rowsPerPage"
      :filter-options="filterOptions"
      :server-options="serverOptions"
      :items-selected="itemsSelected"
      :body-row-class-name="bodyRowClassName"
      :empty-message="emptyMessage"
      @update:items-selected="(s: Item[]) => emits('update:itemsSelected', s)"
      @update:server-options="(o: ServerOptions) => emits('update:serverOptions', o)"
      @click-row="(a: ClickRowArgument) => emits('click-row', a)"
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
        {{ header.text ? t(header.text) : '' }}
      </template>
      <!-- Standard-Slot weiterleiten -->
      <template v-for="(_, slot) in $slots" v-slot:[slot]="scope">
        <slot :name="slot" v-bind="scope"></slot>
      </template>
    </Vue3EasyDataTable>
  </div>
</template>

<script lang="ts" setup>
import { PropType, ref } from 'vue'
import type { ClickRowArgument, FilterOption, Header, Item, ServerOptions, SortType } from 'vue3-easy-data-table'
import Vue3EasyDataTable from 'vue3-easy-data-table'
import 'vue3-easy-data-table/dist/style.css'
import { useI18n } from 'vue-i18n'
import ArrowSortableList from '@/components/elements/ArrowSortableList.vue'
import { deleteFromDB, readFromDB, storeToDB } from '@/indexedDB'

import '@/vue3-easy-data-table.css'

const { t } = useI18n()

const props = defineProps({
  dbKey: { type: String },
  columnsToHide: { type: Array as PropType<string[]>, default: () => [] },
  filterOptions: { type: Array as PropType<FilterOption[]> },
  headers: { type: Array as PropType<Header[]>, required: true },
  rowsItems: { type: Array as PropType<number[]>, default: () => [5, 15, 25] },
  rowsPerPage: { type: Number, default: 5 },
  sortBy: { type: String },
  sortType: { type: String as PropType<SortType>, default: 'asc' },
  bodyRowClassName: { type: [String, Function] as PropType<string | ((item: Item, rowNum: number) => string)> },
  emptyMessage: { type: String },
  loading: { type: Boolean },
  serverItemsLength: { type: Number },
  items: { type: Array as PropType<Item[]>, required: true },
  itemsSelected: { type: Array as PropType<Item[]> },
  serverOptions: { type: Object as PropType<ServerOptions> }
})

const emits = defineEmits<{ 'update:itemsSelected': [Item[]]; 'update:serverOptions': [ServerOptions]; 'click-row': [ClickRowArgument] }>()

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
const USE_DB_SETTINGS = typeof props.dbKey === 'string'
const DB_KEY = props.dbKey as string
const dbColumnOrder = USE_DB_SETTINGS ? await readFromDB('columnOrder', DB_KEY) : undefined
if (dbColumnOrder) {
  orderHeaders(dbColumnOrder)
}
const columnOrder = ref(dbColumnOrder || defaultColumnOrder)
const showSettings = ref(false)

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
