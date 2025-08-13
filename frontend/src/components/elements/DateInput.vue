<template>
  <input
    v-if="withTime"
    type="datetime-local"
    class="form-control"
    :value="datetimeToDatetimeString(modelValue)"
    @input="$emit('update:modelValue', htmlInputStringToDateTime(($event.target as HTMLInputElement).value))"
    :disabled="disabled"
    :required="required"
    :min="datetimeToDatetimeString(min)"
    :max="datetimeToDatetimeString(max)" />
  <input
    v-else
    type="date"
    class="form-control"
    :value="datetimeToDateString(modelValue)"
    @input="$emit('update:modelValue', new Date(($event.target as HTMLInputElement).value))"
    :disabled="disabled"
    :required="required"
    :min="datetimeToDateString(min)"
    :max="datetimeToDateString(max)" />
</template>

<script lang="ts">
import { datetimeToDateString, datetimeToDatetimeString, htmlInputStringToDateTime } from 'abrechnung-common/scripts.js'
import { defineComponent, PropType } from 'vue'
export default defineComponent({
  name: 'DateInput',
  data() {
    return {}
  },
  props: {
    modelValue: { type: [String, Date] as PropType<string | Date>, default: '' },
    withTime: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    min: { type: [String, Date] as PropType<string | Date>, default: '' },
    max: { type: [String, Date] as PropType<string | Date>, default: '' }
  },
  emits: ['update:modelValue'],
  methods: { datetimeToDateString, datetimeToDatetimeString, htmlInputStringToDateTime }
})
</script>

<style></style>
