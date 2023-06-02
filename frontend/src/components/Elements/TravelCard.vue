<template>
  <div class="card" style="width: 18rem; cursor: pointer;" @click="$emit('clicked')">
    <div class="card-body">
      <div class="row">
        <div class="col">
          <h5 class="card-title">{{ travel.name ? travel.name : travel.reason }}</h5>
        </div>
        <div class="col-auto">
          <ProgressCircle v-if="['approved', 'underExamination', 'refunded'].indexOf(travel.state) !== -1" :progress="travel.progress"></ProgressCircle>
        </div>
      </div>

      <h6 v-if="showTraveler" class="card-subtitle mb-1 text-muted">{{ travel.traveler.name }}</h6>
      <h6 class="card-subtitle mb-2 text-muted">
        {{ this.$root.datetoDateString(travel.startDate) +
          ' - ' +
          this.$root.datetoDateString(travel.endDate) }}
      </h6>
      <div>
        <StateBadge :state="travel.state"></StateBadge>
      </div>

    </div>
  </div>
</template>

<script>
import ProgressCircle from './ProgressCircle.vue'
import StateBadge from './StateBadge.vue'
export default {
  name: 'TravelCard',
  emits: ['clicked'],
  data() {
    return {
    }
  },
  components: { StateBadge, ProgressCircle },
  props: { travel: { type: Object }, showTraveler: { type: Boolean, default: false } },
  methods: {},
}
</script>

<style></style>