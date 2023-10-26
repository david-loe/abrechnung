<template>
  <CardElement
    :state="healthCareCost.state"
    :name="healthCareCost.name"
    :user="healthCareCost.applicant"
    :editor="healthCareCost.editor"
    :showUser="showUser"
    :showEditor="'refunded' === healthCareCost.state || 'underExaminationByInsurance' === healthCareCost.state"
    :showDropdown="showDropdown"
    @clicked="$emit('clicked')"
    @deleted="$emit('deleted')">
  </CardElement>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import CardElement from '../../elements/CardElement.vue'
import { HealthCareCostSimple } from '../../../../../common/types.js'

export default defineComponent({
  name: 'HealthCareCostCard',
  emits: ['clicked', 'deleted'],
  components: { CardElement },
  props: {
    healthCareCost: { type: Object as PropType<HealthCareCostSimple>, required: true },
    showUser: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  }
})
</script>

<style></style>
