<template>
  <PaginationList :endpoint="endpoint" :params="params" :showSearch="showSearch" ref="list">
    <template #entry="{ entry }">
      <ExpenseReportCard
        :expenseReport="entry"
        :showOwner="showOwner"
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
    params: {type: Object},
    showSearch: { type: Boolean, default: false },
    showOwner: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {
    async deleteExpenseReport(_id: string): Promise<void> {
      const result = await this.$root.deleter('expenseReport', { _id })
      if (result) {
        ;(this.$refs.list as typeof PaginationList).getData()
      }
    },
    getData() {
      ;(this.$refs.list as typeof PaginationList).getData()
    }
  }
})
</script>

<style></style>
