<template>
  <PaginationList :endpoint="endpoint" :showSearch="showSearch" ref="list">
    <template #entry="{ entry }">
      <TravelCard
        :travel="entry"
        :showOwner="showOwner"
        :showDropdown="showDropdown"
        @clicked="$emit('clicked', entry)"
        @deleted="deleteTravel(entry._id)"
        @edit="$emit('edit', entry)"></TravelCard>
    </template>
  </PaginationList>
</template>

<script lang="ts">
import PaginationList from '../../elements/PaginationList.vue'
import { defineComponent } from 'vue'
import { TravelSimple } from '../../../../../common/types.js'
import TravelCard from './TravelCard.vue'

export default defineComponent({
  name: 'TravelCardList',
  emits: ['clicked', 'edit'],
  components: { TravelCard, PaginationList },
  props: {
    endpoint: { type: String, required: true },
    showSearch: { type: Boolean, default: false },
    showOwner: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {
    async deleteTravel(_id: string): Promise<void> {
      const result = await this.$root.deleter('travel', { _id })
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
