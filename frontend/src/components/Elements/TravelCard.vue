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

      <span v-if="showTraveler" class="card-subtitle mb-1 fs-6 fw-medium text-muted">{{ travel.traveler.name }}</span>
      <div class="row mb-2">
        <div class="col-auto">
          <span class="fs-6 fw-medium text-muted">
            {{ datetoDateString(travel.startDate) + ' - ' + datetoDateString(travel.endDate) }}
          </span>
        </div>
        <div v-if="travel.claimSpouseRefund" :title="$t('labels.claimSpouseRefund')" class="col-auto">
          <i class="bi bi-person-plus-fill"></i>
        </div>
      </div>

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
