<template>
  <div class="container py-3">
    <div class="row justify-content-between">
      <div class="col-auto">
        <h2 class="mb-3">{{ $t('accesses.bookable/expenseReport') }}</h2>
      </div>
      <div class="col-auto">
        <button class="btn btn-secondary" @click="handlePrint"><i class="bi bi-printer-fill"></i></button>
      </div>
    </div>

    <ExpenseReportList
      ref="table"
      class="mb-5"
      endpoint="bookable/expenseReport"
      :columns-to-hide="['state']"
      make-name-no-link
      :rows-per-page="10"
      :rows-items="[10, 20, 50]"
      @loaded="hideExpandColumn">
      <template #expand="report">
        <div class="px-3 pb-1 border-bottom border-4">
          <div v-if="report.addUp.length > 1 || report.addUp[0].advance.amount > 0" class="d-inline-block">
            <AddUpTable
              class="table-sm"
              :add-up="report.addUp"
              :project="report.project"
              :showAdvanceOverflow="false"
              id="addUp"></AddUpTable>
          </div>
          <div v-if="report.bookingRemark">
            <small style="white-space: pre-wrap">{{ report.bookingRemark }}</small>
          </div>
        </div>
      </template>
    </ExpenseReportList>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, useTemplateRef } from 'vue'
import { useVueToPrint } from 'vue-to-print'
import APP_LOADER from '@/appData.js'
import AddUpTable from '@/components/elements/AddUpTable.vue'
import ExpenseReportList from '@/components/expenseReport/ExpenseReportList.vue'
import { expandCollapseComments, hideExpandColumn as hideExpCol } from '@/helper'

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
    }
    #addUp tr {
      display: block;
      float: left;
    }
    #addUp th,
    #addUp td {
      display: block;
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
