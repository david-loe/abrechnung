<template>
  <v-select
    v-if="APP_DATA?.categories"
    :options="APP_DATA.categories"
    :modelValue="modelValue"
    :placeholder="placeholder"
    @update:modelValue="(c: Category) => $emit('update:modelValue', c)"
    :filter="filter"
    :getOptionKey="(option: Category) => option._id"
    :getOptionLabel="(option: Category) => option.name"
    :disabled="disabled"
    style="min-width: 160px">
    <template #option="category">
      <Badge class="m-1" :text="category.name" :style="category.style"></Badge>
    </template>
    <template #selected-option="category">
      <Badge :text="category.name" :style="category.style"></Badge>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script lang="ts">
import { Category } from 'abrechnung-common/types.js'
import { defineComponent, PropType } from 'vue'
import APP_LOADER from '@/appData.js'
import Badge from '@/components/elements/Badge.vue'

export default defineComponent({
  name: 'CategorySelector',
  data() {
    return { APP_DATA: APP_LOADER.data }
  },
  components: { Badge },
  props: {
    modelValue: { type: Object as PropType<Category> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: Category[], search: string): Category[] {
      return options.filter((option) => option.name.toLowerCase().indexOf(search.toLowerCase()) > -1)
    }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
