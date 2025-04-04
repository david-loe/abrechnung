<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.refunded/expenseReport') }}</h1>
    <ExpenseReportList class="mb-5" endpoint="refunded/expenseReport" :columns-to-hide="['state']" make-name-no-link> </ExpenseReportList>
  </div>
</template>

<script lang="ts" setup>
import APP_LOADER from '@/appData.js'
import { onMounted } from 'vue'
import ExpenseReportList from './ExpenseReportList.vue'

onMounted(async () => {
  await APP_LOADER.loadData()
})
</script>
