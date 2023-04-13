<template>
  <div class="card" style="width: 18rem; cursor: pointer;" @click="$emit('clicked')">
      <div class="card-body">
        <h5 class="card-title">{{ travel.name ? travel.name : travel.reason }}</h5>
        <h6 v-if="showTraveler" class="card-subtitle mb-1 text-muted">{{travel.traveler.name}}</h6>
        <h6 class="card-subtitle mb-2 text-muted">
          {{
            this.$root.datetoDateString(travel.startDate) +
            ' - ' +
            this.$root.datetoDateString(travel.endDate)
          }}
        </h6>
        <div>
          <StateBadge :state="travel.state"></StateBadge>
        </div>
      </div>
  </div>
</template>

<script>
import StateBadge from './StateBadge.vue'
export default {
  name: 'TravelCard',
  emits: ['clicked'],
  data() {
    return {
    }
  },
  components: {StateBadge},
  props: { travel: { type: Object }, showTraveler: {type: Boolean, default: false} },
  methods: {},
}
</script>

<style>
</style>