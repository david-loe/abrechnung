<template>
  <CardElement
    :request="travel"
    :showOwner="showOwner"
    :showEditor="travel.owner._id !== travel.editor._id"
    :showDropdown="showDropdown"
    @clicked="$emit('clicked')"
    @deleted="$emit('deleted')">
    <template #top-right>
      <ProgressCircle v-if="['approved', 'underExamination'].indexOf(travel.state) !== -1" :progress="travel.progress"></ProgressCircle>
    </template>
    <template #dropdown-items>
      <li>
        <a
          :class="'dropdown-item' + (['underExamination', 'refunded'].indexOf(travel.state) != -1 ? ' disabled' : '')"
          href="#"
          @click=";['underExamination', 'refunded'].indexOf(travel.state) != -1 ? null : $emit('edit')">
          <span class="me-1"><i class="bi bi-pencil"></i></span>
          <span>{{ $t('labels.editX', { X: $t('labels.travelDetails') }) }}</span>
        </a>
      </li>
    </template>

    <template #details>
      <div class="col-auto">
        <span class="fs-6 fw-medium text-muted">
          {{ datetoDateString(travel.startDate) + ' - ' + datetoDateString(travel.endDate) }}
        </span>
      </div>
      <div v-if="travel.claimSpouseRefund" :title="$t('labels.claimSpouseRefund')" class="col-auto">
        <i class="bi bi-person-plus-fill"></i>
      </div>
    </template>
  </CardElement>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import CardElement from '../../elements/CardElement.vue'
import ProgressCircle from '../../elements/ProgressCircle.vue'
import { datetoDateString } from '../../../../../common/scripts.js'
import { TravelSimple } from '../../../../../common/types.js'

export default defineComponent({
  name: 'TravelCard',
  emits: ['clicked', 'deleted', 'edit'],
  components: { CardElement, ProgressCircle },
  props: {
    travel: { type: Object as PropType<TravelSimple>, required: true },
    showOwner: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  },
  methods: {
    datetoDateString
  }
})
</script>

<style></style>
