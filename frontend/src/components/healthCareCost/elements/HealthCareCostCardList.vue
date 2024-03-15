<template>
  <PaginationList :endpoint="endpoint" :params="params" :showSearch="showSearch" ref="list">
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
import { defineComponent } from 'vue'
import PaginationList from '../../elements/PaginationList.vue'
import HealthCareCostCard from './HealthCareCostCard.vue'

export default defineComponent({
  name: 'HealthCareCostCardList',
  emits: ['clicked'],
  components: { HealthCareCostCard, PaginationList },
  props: {
    endpoint: { type: String, required: true },
    params: {type: Object},
    showSearch: { type: Boolean, default: false },
    showOwner: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {
    async deleteHealthCareCost(_id: string): Promise<void> {
      const result = await this.$root.deleter('healthCareCost', { _id })
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
