<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.refunded/expenseReport') }}</h1>
    <ExpenseReportList class="mb-5" endpoint="refunded/expenseReport" :columns-to-hide="['state']" make-name-no-link> </ExpenseReportList>
  </div>
</template>

<script lang="ts" setup>
import APP_LOADER from '@/appData.js'
import ExpenseReportList from '@/components/expenseReport/ExpenseReportList.vue'
import { onMounted } from 'vue'

onMounted(async () => {
  await APP_LOADER.loadData()
})
</script>
