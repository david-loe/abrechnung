<template>
  <div class="container py-3">
    <div class="row justify-content-between">
      <div class="col-auto">
        <h2>{{ $t('accesses.book/healthCareCost') }}</h2>
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

    <HealthCareCostList
      ref="table"
      class="mb-5"
      table-class-name="small-table"
      endpoint="book/healthCareCost"
      :columns-to-hide="['state']"
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
    </HealthCareCostList>
    <button v-if="!show" type="button" class="btn btn-light" @click="show = HealthCareCostState.BOOKED">
      {{ t('labels.show') }} <StateBadge :state="HealthCareCostState.BOOKED" :StateEnum="HealthCareCostState"></StateBadge>
      <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="show = null">
        {{ t('labels.hide') }} <StateBadge :state="show" :StateEnum="HealthCareCostState"></StateBadge> <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <HealthCareCostList
        class="mb-5"
        table-class-name="small-table"
        endpoint="book/healthCareCost"
        :columns-to-hide="['state']"
        make-name-no-link
        :stateFilter="show"
        :rows-per-page="10"
        :rows-items="[10, 20, 50]">
      </HealthCareCostList>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ComponentPublicInstance, MaybeRefOrGetter, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVueToPrint } from 'vue-to-print'
import { HealthCareCostSimple, HealthCareCostState, State } from '@/../../common/types'
import API from '@/api'
import AddUpTable from '@/components/elements/AddUpTable.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import HealthCareCostList from '@/components/healthCareCost/HealthCareCostList.vue'
import { expandCollapseComments, hideExpandColumn as hideExpCol } from '@/helper'

const { t } = useI18n()

const tableRef = useTemplateRef('table')

const selected = ref([])
const show = ref<null | HealthCareCostState.BOOKED>(null)
const loading = ref(false)

async function book(healthCareCosts: HealthCareCostSimple[]) {
  loading.value = true
  const result = await API.setter(
    'book/healthCareCost/booked',
    healthCareCosts.map((e) => e._id)
  )
  loading.value = false
  if (result.ok) {
    selected.value = []
    tableRef.value?.loadFromServer()
  }
}

let colDeleted = false

function hideExpandColumn() {
  hideExpCol(colDeleted, 1)
  colDeleted = true
}

const { handlePrint } = useVueToPrint({
  content: tableRef as MaybeRefOrGetter<HTMLElement | ComponentPublicInstance>,
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
