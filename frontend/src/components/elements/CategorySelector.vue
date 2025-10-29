<template>
  <v-select
    v-if="APP_DATA?.categories"
    :options="APP_DATA.categories"
    :modelValue="props.modelValue"
    :placeholder="props.placeholder"
    @update:modelValue="(c: Category) => emit('update:modelValue', c)"
    :filter="filter"
    :getOptionKey="(option: Category) => option._id"
    :getOptionLabel="(option: Category) => option.name"
    :disabled="props.disabled"
    style="min-width: 160px">
    <template #option="category">
      <Badge class="m-1" :text="category.name" :style="category.style"></Badge>
    </template>
    <template #selected-option="category">
      <Badge :text="category.name" :style="category.style"></Badge>
    </template>
    <template v-if="props.required" #search="{ attributes, events }">
      <input class="vs__search" :required="!props.modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script lang="ts" setup>
import { Category } from 'abrechnung-common/types.js'
import { PropType } from 'vue'
import Badge from '@/components/elements/Badge.vue'
import APP_LOADER from '@/dataLoader.js'

const APP_DATA = APP_LOADER.data

const props = defineProps({
  modelValue: { type: Object as PropType<Category> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' }
})
const emit = defineEmits<{ 'update:modelValue': [Category] }>()

function filter(options: Category[], search: string): Category[] {
  return options.filter((option) => option.name.toLowerCase().indexOf(search.toLowerCase()) > -1)
}

await APP_LOADER.loadData()
</script>

<style></style>
