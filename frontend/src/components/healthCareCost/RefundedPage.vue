<template>
  <div class="container py-3">
    <div class="row justify-content-between">
      <div class="col-auto">
        <h2 class="mb-3">{{ $t('accesses.refunded/healthCareCost') }}</h2>
      </div>
      <div class="col-auto">
        <button class="btn btn-secondary" @click="handlePrint"><i class="bi bi-printer-fill"></i></button>
      </div>
    </div>
    <HealthCareCostList
      ref="table"
      class="mb-5"
      endpoint="refunded/healthCareCost"
      :columns-to-hide="['state', 'updatedAt']"
      make-name-no-link
      :rows-per-page="10"
      :rows-items="[10, 20, 50]"
      @loaded="hideExpandColumn">
      <template #expand="{ bookingRemark }">
        <div v-if="bookingRemark" class="px-3 pb-1 border-bottom border-4">
          <small style="white-space: pre-wrap">{{ bookingRemark }}</small>
        </div>
      </template>
    </HealthCareCostList>
  </div>
</template>

<script lang="ts" setup>
import APP_LOADER from '@/appData.js'
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'
import { expandCollapseComments, hideExpandColumn as hideExpCol } from '@/helper'
import { onMounted, useTemplateRef } from 'vue'
import { useVueToPrint } from 'vue-to-print'

const tableRef = useTemplateRef('table')
let colDeleted = false

function hideExpandColumn() {
  hideExpCol(colDeleted)
  colDeleted = true
}

const { handlePrint } = useVueToPrint({
  content: tableRef as any,
  documentTitle: 'List',
  removeAfterPrint: true,
  onBeforeGetContent() {
    return new Promise((resolve) => {
      expandCollapseComments()
      queueMicrotask(resolve)
    })
  },
  onAfterPrint() {
    expandCollapseComments()
  },
  pageStyle: `
    @page {
      size: landscape; /* Sets the page to landscape orientation */
      margin: 0;        /* Removes header and footer margins */
    }`
})

onMounted(async () => {
  await APP_LOADER.loadData()
})
</script>

<style>
.vue3-easy-data-table__body td.expand {
  padding: 0 !important;
}
</style>
