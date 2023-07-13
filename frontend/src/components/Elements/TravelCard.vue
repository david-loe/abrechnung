<template>
  <div class="card" style="width: 18rem; cursor: pointer" @click="$emit('clicked')">
    <div class="card-body">
      <div class="row">
        <div class="col">
          <h5 class="card-title">{{ travel.name }}</h5>
        </div>
        <div class="col-auto">
          <ProgressCircle v-if="['approved', 'underExamination'].indexOf(travel.state) !== -1" :progress="travel.progress"></ProgressCircle>
        </div>
      </div>

      <h6 v-if="showTraveler" class="card-subtitle mb-1 text-muted">{{ travel.traveler.name }}</h6>
      <h6 class="card-subtitle mb-2 text-muted">
        {{ datetoDateString(travel.startDate) + ' - ' + datetoDateString(travel.endDate) }}
      </h6>
      <div>
        <StateBadge :state="travel.state"></StateBadge>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import ProgressCircle from './ProgressCircle.vue'
import StateBadge from './StateBadge.vue'
import { datetoDateString } from '../../../../common/scriptsts'
import { TravelSimple } from '../../../../common/types'

export default defineComponent({
  name: 'TravelCard',
  emits: ['clicked'],
  components: { StateBadge, ProgressCircle },
  props: { travel: { type: Object as PropType<TravelSimple>, required: true }, showTraveler: { type: Boolean, default: false } },
  methods: { datetoDateString }
})
</script>

<style></style>
