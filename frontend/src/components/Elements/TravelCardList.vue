<template>
  <div style="min-height: 120px;">
    <div class="row justify-content-center gx-4 gy-2">
      <div class="col-auto" v-for="travel of travels" :key="travel._id">
        <TravelCard v-if="travel" :travel="travel" :showTraveler="showTraveler" @clicked="$emit('clicked', travel)"></TravelCard>
      </div>
    </div>
    <div v-if="travels.length === 0" class="alert alert-light" role="alert">
      {{ $t('alerts.noTravels.' + this.endpoint) }}
    </div>
    <div v-else-if="meta && meta.countPages > 1" class="mx-auto text-secondary" style="width: fit-content;">
      <span class="me-2 p-2" style="cursor: pointer;" @click="getTravels(meta.page - 1)">&lt;</span>
      <span v-for="x of meta.countPages" :class="'me-2 p-2' + (meta.page == x ? ' fs-5' : '')" :key="x" :style="meta.page == x ? '' : 'cursor: pointer;'" @click="meta.page == x ? null : getTravels(x)">{{ x }}</span>
      <span class="p-2" style="cursor: pointer;" @click="getTravels(meta.page + 1)">&gt;</span>
    </div>
  </div>
</template>
  
<script>
import TravelCard from './TravelCard.vue'
export default {
  name: 'TravelCardList',
  emits: ['clicked'],
  data() {
    return {
      travels: [false],
      meta: false
    }
  },
  components: { TravelCard },
  props: { endpoint: { type: String }, showTraveler: { type: Boolean, default: false } },
  methods: {
    async getTravels(page) {
      if(page === 0 || page){
        if(page < 1){
          page = 1
        }else if(this.meta && page > this.meta.countPages){
          page = this.meta.countPages
        }
      }else if(this.meta){
        page = this.meta.page
      }
      var result = await this.$root.getter(this.endpoint, { page })
      this.travels = result.data
      this.meta = result.meta
    }
  },
  async beforeMount() {
    await this.getTravels()
  }
}
</script>
  
<style></style>