<template>
  <input
    v-if="props.withTime"
    type="datetime-local"
    class="form-control"
    :value="datetimeToDatetimeString(props.modelValue)"
    @input="emit('update:modelValue', htmlInputStringToDateTime(($event.target as HTMLInputElement).value))"
    :disabled="props.disabled"
    :required="props.required"
    :min="datetimeToDatetimeString(props.min)"
    :max="datetimeToDatetimeString(props.max)" >
  <input
    v-else
    type="date"
    class="form-control"
    :value="datetimeToDateString(props.modelValue)"
    @input="emit('update:modelValue', new Date(($event.target as HTMLInputElement).value))"
    :disabled="props.disabled"
    :required="props.required"
    :min="datetimeToDateString(props.min)"
    :max="datetimeToDateString(props.max)" >
</template>

<script lang="ts" setup>
import { datetimeToDateString, datetimeToDatetimeString, htmlInputStringToDateTime } from 'abrechnung-common/utils/scripts.js'
import { PropType } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Date] as PropType<string | Date>, default: '' },
  withTime: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  min: { type: [String, Date] as PropType<string | Date>, default: '' },
  max: { type: [String, Date] as PropType<string | Date>, default: '' }
})
const emit = defineEmits<{ 'update:modelValue': [Date | null] }>()
</script>

<style></style>
