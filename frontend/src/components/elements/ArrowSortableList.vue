<template>
  <ul class="list-group list-group-horizontal">
    <li v-for="(text, idx) in items" :key="idx" class="list-group-item d-flex align-items-center px-2 py-1">
      <button type="button" class="btn p-0" v-if="idx > 0" @click="move(idx, idx - 1)">
        <i class="bi bi-arrow-left-square"></i>
      </button>
      <span class="mx-2">{{ props.labelFn !== undefined ? props.labelFn(text) : text }}</span>
      <button type="button" class="btn p-0" v-if="idx < items.length - 1" @click="move(idx, idx + 1)">
        <i class="bi bi-arrow-right-square"></i>
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts" generic="T extends string | Record<string, unknown>">
import { shallowRef, watch } from 'vue'

const props = defineProps<{ modelValue: T[]; labelFn?: (item: T) => string }>()
const emit = defineEmits(['update:modelValue'])

const items = shallowRef([...props.modelValue])

watch(
  () => props.modelValue,
  (val) => {
    items.value = [...val]
  }
)

function move(from: number, to: number) {
  if (to < 0 || to >= items.value.length) return
  const arr = [...items.value]
  arr.splice(to, 0, arr.splice(from, 1)[0])
  items.value = arr
  emit('update:modelValue', arr)
}
</script>
