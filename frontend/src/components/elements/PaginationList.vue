<template>
  <EasyDataTable
    class="mb-3"
    :rows-items="[5, 15, 25]"
    :rows-per-page="5"
    v-model:server-options="serverOptions"
    :server-items-length="serverItemsLength"
    :loading="loading"
    :items="items"
    sort-by="name"
    :headers="headers">
    <template #item-state="{ state }">
      <StateBadge :state="state"></StateBadge>
    </template>
    <template #item-typ="report">
      <template v-if="reportIsTravel(report)">
        <i class="bi bi-airplane"></i>
      </template>
      <template v-else-if="reportIsHealthCareCost(report)">
        <i class="bi bi-hospital"></i>
      </template>
      <template v-else>
        <i class="bi bi-coin"></i>
      </template>
    </template>
  </EasyDataTable>
</template>

<script lang="ts" setup>
import API from '@/api.js'
import i18n from '@/i18n.js'
import { ref, watch } from 'vue'
import type { Header, Item, ServerOptions } from 'vue3-easy-data-table'
import { reportIsHealthCareCost, reportIsTravel } from '../../../../common/types'
import StateBadge from './StateBadge.vue'

interface Props {
  endpoint: string
  showSearch: boolean
}

const props = defineProps<Props>()

const headers: Header[] = [
  { text: '', value: 'typ' }, //@ts-ignore
  { text: i18n.global.t('labels.name'), value: 'name' },
  { text: i18n.global.t('labels.project'), value: 'project.identifier', sortable: true },
  { text: i18n.global.t('labels.state'), value: 'state' }
]

const items = ref<Item[]>([])

const loading = ref(false)
const serverItemsLength = ref(0)
const serverOptions = ref<ServerOptions>({
  page: 1,
  rowsPerPage: 5,
  sortBy: 'age',
  sortType: 'desc'
})

const loadFromServer = async () => {
  loading.value = true
  let result = (await API.getter<any[]>(props.endpoint, { page: serverOptions.value.page, limit: serverOptions.value.rowsPerPage })).ok
  if (result) {
    items.value = result.data
    serverItemsLength.value = result.meta.count
    console.log(result.meta)
  }
  loading.value = false
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
</script>

<style></style>
