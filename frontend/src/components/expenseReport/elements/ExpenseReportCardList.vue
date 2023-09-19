<template>
  <PaginationList :endpoint="endpoint" ref="list">
    <template #entry="{ entry }">
      <ExpenseReportCard
        :expenseReport="entry"
        :showUser="showUser"
        :showDropdown="showDropdown"
        @clicked="$emit('clicked', entry)"
        @deleted="deleteExpenseReport(entry._id)"></ExpenseReportCard>
    </template>
  </PaginationList>
</template>

<script lang="ts">
import PaginationList from '../../elements/PaginationList.vue'
import { defineComponent } from 'vue'
import ExpenseReportCard from './ExpenseReportCard.vue'

export default defineComponent({
  name: 'ExpenseReportCardList',
  emits: ['clicked'],
  components: { ExpenseReportCard, PaginationList },
  props: {
    endpoint: { type: String, required: true },
    showUser: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {
    async deleteExpenseReport(id: string): Promise<void> {
      const result = await this.$root.deleter('expenseReport', { id: id })
      if (result) {
        ;(this.$refs.list as typeof PaginationList).getData()
      }
    }
  }
})
</script>

<style></style>
