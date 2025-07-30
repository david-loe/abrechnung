<template>
  <ul class="list-group list-group-horizontal">
    <li v-for="(text, idx) in items" :key="idx" class="list-group-item d-flex align-items-center px-2 py-1">
      <i @click="move(idx, idx - 1)" v-if="idx > 0" class="bi bi-arrow-left-square" style="cursor: pointer"></i>
      <span class="mx-2">{{ props.labelFn ? props.labelFn(text) : text }}</span>
      <i @click="move(idx, idx + 1)" v-if="idx < items.length - 1" class="bi bi-arrow-right-square" style="cursor: pointer"></i>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

type Item = string | Record<string, unknown>

const props = defineProps<{ modelValue: Item[]; labelFn?: (c: Item[]) => string }>()
const emit = defineEmits(['update:modelValue'])

const items = ref([...props.modelValue])

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
