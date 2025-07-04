<template>
  <div class="container py-3">
    <div class="row justify-content-between">
      <div class="col-auto">
        <h2>{{ $t('accesses.book/advance') }}</h2>
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

    <AdvanceList
      ref="table"
      class="mb-5"
      table-class-name="small-table"
      endpoint="book/advance"
      :columns-to-hide="['balance', 'updatedAt', 'state']"
      make-name-no-link
      :rows-per-page="10"
      :rows-items="[10, 20, 50]"
      :stateFilter="State.BOOKABLE"
      v-model:items-selected="selected"
      @loaded="hideExpandColumn">
      <template #expand="{ bookingRemark }">
        <div v-if="bookingRemark" class="px-3 pb-1 border-bottom border-4">
          <small style="white-space: pre-wrap">{{ bookingRemark }}</small>
        </div>
      </template>
    </AdvanceList>
    <button v-if="!show" type="button" class="btn btn-light" @click="show = AdvanceState.BOOKED">
      {{ t('labels.show') }} <StateBadge :state="AdvanceState.BOOKED" :StateEnum="AdvanceState"></StateBadge>
      <i class="bi bi-chevron-down"></i>
    </button>
    <template v-else>
      <button type="button" class="btn btn-light" @click="show = null">
        {{ t('labels.hide') }} <StateBadge :state="show" :StateEnum="AdvanceState"></StateBadge> <i class="bi bi-chevron-up"></i>
      </button>
      <hr class="hr" />
      <AdvanceList
        class="mb-5"
        table-class-name="small-table"
        endpoint="book/advance"
        :columns-to-hide="['balance', 'log.30.on', 'state']"
        make-name-no-link
        :stateFilter="show"
        :rows-per-page="10"
        :rows-items="[10, 20, 50]">
      </AdvanceList>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ComponentPublicInstance, MaybeRefOrGetter, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVueToPrint } from 'vue-to-print'
import { AdvanceSimple, AdvanceState, State } from '@/../../common/types'
import API from '@/api'
import AdvanceList from '@/components/advance/AdvanceList.vue'
import StateBadge from '@/components/elements/StateBadge.vue'
import { expandCollapseComments, hideExpandColumn as hideExpCol } from '@/helper'

const { t } = useI18n()
const tableRef = useTemplateRef('table')

const selected = ref([])
const show = ref<null | AdvanceState.BOOKED>(null)
const loading = ref(false)

async function book(advances: AdvanceSimple[]) {
  loading.value = true
  const result = await API.setter(
    'book/advance/booked',
    advances.map((e) => e._id)
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
