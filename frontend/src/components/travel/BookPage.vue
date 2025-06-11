<template>
  <div class="container py-3">
    <div class="row justify-content-between">
      <div class="col-auto">
        <h2>{{ $t('accesses.book/travel') }}</h2>
      </div>
      <div class="col-auto">
        <button class="btn btn-secondary" @click="handlePrint"><i class="bi bi-printer-fill"></i></button>
      </div>
    </div>
    <div class="mb-3 d-flex align-items-center">
      <button type="button" class="btn btn-success" :disabled="selected.length === 0 || loading" @click="book(selected)">
        {{ t('labels.setSelectedToBooked') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1"></span>
    </div>

    <TravelList
      ref="table"
      class="mb-5"
      table-class-name="small-table"
      endpoint="book/travel"
      :columns-to-hide="['state', 'startDate']"
      make-name-no-link
      :rows-per-page="10"
      :rows-items="[10, 20, 50]"
      :stateFilter="State.BOOKABLE"
      v-model:items-selected="selected"
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
    </TravelList>
    <button v-if="!show" type="button" class="btn btn-light" @click="show = TravelState.BOOKED">
      {{ t('labels.show') }} <StateBadge :state="TravelState.BOOKED" :StateEnum="TravelState"></StateBadge>
      <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="show = null">
        {{ t('labels.hide') }} <StateBadge :state="show" :StateEnum="TravelState"></StateBadge> <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <TravelList
        class="mb-5"
        table-class-name="small-table"
        endpoint="book/travel"
        :columns-to-hide="['state', 'startDate']"
        make-name-no-link
        :stateFilter="show"
        :rows-per-page="10"
        :rows-items="[10, 20, 50]">
      </TravelList>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVueToPrint } from 'vue-to-print'
import { State, TravelSimple, TravelState } from '@/../../common/types'
import API from '@/api'
import AddUpTable from '@/components/elements/AddUpTable.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import TravelList from '@/components/travel/TravelList.vue'
import { expandCollapseComments, hideExpandColumn as hideExpCol } from '@/helper'

const { t } = useI18n()

const tableRef = useTemplateRef('table')

const selected = ref([])
const show = ref<null | TravelState.BOOKED>(null)
const loading = ref(false)

async function book(expenseReports: TravelSimple[]) {
  loading.value = true
  const result = await API.setter(
    'book/travel/booked',
    expenseReports.map((e) => e._id)
  )
  loading.value = false
  if (result.ok) {
    tableRef.value?.loadFromServer()
  }
}

let colDeleted = false

function hideExpandColumn() {
  hideExpCol(colDeleted, 1)
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
</script>

<style>
.small-table {
  --easy-table-header-font-size: 0.9em;
  --easy-table-body-row-font-size: 0.9em;
}

.vue3-easy-data-table__body td.expand {
  padding: 0 !important;
}
</style>
