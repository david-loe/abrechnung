<template>
  <CardElement
    :request="healthCareCost"
    :showOwner="showOwner"
    :showEditor="'refunded' === healthCareCost.state || 'underExaminationByInsurance' === healthCareCost.state"
    :showDropdown="showDropdown"
    @clicked="$emit('clicked')"
    @deleted="$emit('deleted')">
  </CardElement>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { HealthCareCostSimple } from '../../../../../common/types.js';
import CardElement from '../../elements/CardElement.vue';

export default defineComponent({
  name: 'HealthCareCostCard',
  emits: ['clicked', 'deleted'],
  components: { CardElement },
  props: {
    healthCareCost: { type: Object as PropType<HealthCareCostSimple>, required: true },
    showOwner: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  }
})
</script>

<style></style>
