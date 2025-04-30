<template>
  <textarea
    v-model="modelValue"
    class="form-control"
    rows="1"
    ref="textarea"
    @input="autoResize"
    :disabled="disabled"
    :required="required"></textarea>
</template>

<script setup lang="ts">
import { nextTick, onMounted, useTemplateRef } from 'vue'

const modelValue = defineModel<string | undefined | null>()
const props = defineProps({ disabled: { type: Boolean, default: false }, required: { type: Boolean, default: false } })
const textarea = useTemplateRef('textarea')

function autoResize() {
  if (!textarea.value) return
  textarea.value.style.height = 'auto'
  textarea.value.style.height = `${textarea.value.scrollHeight}px`
}

onMounted(() => {
  nextTick(() => autoResize())
})
</script>
