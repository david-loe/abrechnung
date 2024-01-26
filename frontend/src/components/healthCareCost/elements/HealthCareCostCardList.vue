<template>
  <PaginationList :endpoint="endpoint" :showSearch="showSearch" ref="list">
    <template #entry="{ entry }">
      <HealthCareCostCard
        :healthCareCost="entry"
        :showOwner="showOwner"
        :showDropdown="showDropdown"
        @clicked="$emit('clicked', entry)"
        @deleted="deleteHealthCareCost(entry._id)"></HealthCareCostCard>
    </template>
  </PaginationList>
</template>

<script lang="ts">
import PaginationList from '../../elements/PaginationList.vue'
import { defineComponent } from 'vue'
import HealthCareCostCard from './HealthCareCostCard.vue'

export default defineComponent({
  name: 'HealthCareCostCardList',
  emits: ['clicked'],
  components: { HealthCareCostCard, PaginationList },
  props: {
    endpoint: { type: String, required: true },
    showSearch: { type: Boolean, default: false },
    showOwner: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {
    async deleteHealthCareCost(id: string): Promise<void> {
      const result = await this.$root.deleter('healthCareCost', { id: id })
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
