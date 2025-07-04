<template>
  <v-select
    v-if="APP_DATA?.users"
    :options="APP_DATA.users"
    :modelValue="modelValue"
    :placeholder="placeholder"
    @update:modelValue="(u: UserWithNameAndProject) => $emit('update:modelValue', u)"
    :filter="filter"
    :getOptionKey="(option: UserWithNameAndProject) => option._id"
    :getOptionLabel="(option: UserWithNameAndProject) => `${formatter.name(option.name)}`"
    :disabled="disabled"
    style="min-width: 160px">
    <template #option="{ name }">
      <span>{{ formatter.name(name) }}</span>
    </template>
    <template #selected-option="{ name }">
      <span class="text-truncate">{{ formatter.name(name) }}</span>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script lang="ts" setup>
import { PropType } from 'vue'
import { UserWithNameAndProject } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import { formatter } from '@/formatter.js'

defineProps({
  modelValue: { type: Object as PropType<UserWithNameAndProject> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' }
})

defineEmits<{ 'update:modelValue': [UserWithNameAndProject] }>()

await APP_LOADER.loadData()
const APP_DATA = APP_LOADER.data

function filter(options: UserWithNameAndProject[], search: string): UserWithNameAndProject[] {
  return options.filter((option) => {
    const givenName = option.name.givenName.toLowerCase().indexOf(search.toLowerCase()) > -1
    if (givenName) {
      return givenName
    }
    const familyName = option.name.familyName.toLowerCase().indexOf(search.toLowerCase()) > -1
    if (familyName) {
      return familyName
    }
    return formatter.name(option.name).toLowerCase().indexOf(search.toLowerCase()) > -1
  })
}
</script>

<style></style>
