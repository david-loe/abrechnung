<template>
  <div style="min-height: 120px">
    <template v-if="hasTravels">
      <div class="row justify-content-center gx-4 gy-2">
        <div class="col-auto" v-for="travel of travels" :key="travel._id">
          <TravelCard
            v-if="travel"
            :travel="travel"
            :showTraveler="showTraveler"
            :showDropdown="showDropdown"
            @clicked="$emit('clicked', travel)"
            @deleted="deleteTravel(travel._id)"
            @edit="$emit('edit', travel)"></TravelCard>
        </div>
      </div>
      <div v-if="travels.length === 0" class="alert alert-light" role="alert">
        {{ $t('alerts.noTravels.' + endpoint) }}
      </div>
      <div v-else-if="meta && meta.countPages > 1" class="mx-auto text-secondary" style="width: fit-content">
        <span class="me-2 p-2" style="cursor: pointer" @click="getTravels(meta.page - 1)">&lt;</span>
        <span
          v-for="x of meta.countPages"
          :class="'me-2 p-2' + (meta.page == x ? ' fs-5' : '')"
          :key="x"
          :style="meta.page == x ? '' : 'cursor: pointer;'"
          @click="meta.page == x ? null : getTravels(x)"
          >{{ x }}</span
        >
        <span class="p-2" style="cursor: pointer" @click="getTravels(meta.page + 1)">&gt;</span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { TravelSimple } from '../../../../common/types.js'
import TravelCard from './TravelCard.vue'
export default defineComponent({
  name: 'TravelCardList',
  emits: ['clicked', 'edit'],
  data() {
    return {
      hasTravels: false,
      hasMeta: false,
      travels: [] as TravelSimple[],
      meta: { countPages: -1, page: -1 }
    }
  },
  components: { TravelCard },
  props: {
    endpoint: { type: String, required: true },
    showTraveler: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {
    async getTravels(page?: number): Promise<void> {
      if (page === 0 || page) {
        if (page < 1) {
          page = 1
        } else if (this.hasMeta && page > this.meta.countPages) {
          page = this.meta.countPages
        }
      } else if (this.hasMeta) {
        page = this.meta.page
      }
      var result = await this.$root.getter(this.endpoint, { page })
      this.travels = result.data
      this.hasTravels = true
      this.meta = result.meta
      this.hasMeta = true
    },
    async deleteTravel(id: string): Promise<void> {
      const result = await this.$root.deleter('travel', { id: id })
      if (result) {
        this.getTravels()
      }
    }
  },
  async beforeMount() {
    await this.getTravels()
  }
})
</script>

<style></style>
