<template>
  <div class="container">
    <h1 class="mb-3">{{ $t('accesses.refunded/expenseReport') }}</h1>
    <ExpenseReportList class="mb-5" endpoint="refunded/expenseReport" :columns-to-hide="['state']"> </ExpenseReportList>
  </div>
</template>

<script lang="ts" setup>
import ExpenseReportList from './ExpenseReportList.vue'
</script>
