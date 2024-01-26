<template>
  <CardElement
    :request="expenseReport"
    :showOwner="showOwner"
    :showEditor="'refunded' === expenseReport.state"
    :showDropdown="showDropdown"
    @clicked="$emit('clicked')"
    @deleted="$emit('deleted')">
  </CardElement>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import CardElement from '../../elements/CardElement.vue'
import { ExpenseReportSimple } from '../../../../../common/types.js'

export default defineComponent({
  name: 'ExpenseReportCard',
  emits: ['clicked', 'deleted'],
  components: { CardElement },
  props: {
    expenseReport: { type: Object as PropType<ExpenseReportSimple>, required: true },
    showOwner: { type: Boolean, default: false },
    showDropdown: { type: Boolean, default: false }
  }
})
</script>

<style></style>
