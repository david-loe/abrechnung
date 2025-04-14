<template>
  <div class="container py-3">
    <div class="row justify-content-between">
      <div class="col-auto">
        <h1 class="mb-3">{{ $t('accesses.refunded/travel') }}</h1>
      </div>
      <div class="col-auto">
        <button class="btn btn-secondary" @click="handlePrint"><i class="bi bi-printer-fill"></i></button>
      </div>
    </div>
    <TravelList
      ref="table"
      class="mb-5"
      endpoint="refunded/travel"
      :columns-to-hide="['state', 'startDate']"
      make-name-no-link
      :rows-per-page="10"
      :rows-items="[10, 20, 50]"
      @loaded="hideExpandColumn">
      <template #expand="{ comments }">
        <div class="m-1" v-for="comment in comments" :key="comment._id">
          <small>
            <i>{{ `${(comment as Comment).author.name.givenName} ${(comment as Comment).author.name.familyName.substring(0, 1)}: ` }}</i>
            <span>{{ (comment as Comment).text }}</span>
          </small>
        </div>
      </template>
    </TravelList>
  </div>
</template>

<script lang="ts" setup>
import { Comment } from '@/../../common/types'
import APP_LOADER from '@/appData.js'
import TravelList from '@/components/travel/TravelList.vue'
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
  documentTitle: 'AwesomeFileName',
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
