<template>
  <v-select
    v-if="APP_DATA?.users"
    :options="APP_DATA.users"
    :modelValue="modelValue"
    :placeholder="placeholder"
    @update:modelValue="(u: UserWithNameAndProject) => $emit('update:modelValue', u)"
    :filter="filter"
    :getOptionKey="(option: UserWithNameAndProject) => option._id"
    :getOptionLabel="(option: UserWithNameAndProject) => `${option.name.givenName} ${option.name.familyName}`"
    :disabled="disabled"
    style="min-width: 160px">
    <template #option="{ name }">
      <span>{{ name.givenName + ' ' + name.familyName }}</span>
    </template>
    <template #selected-option="{ name }">
      <span class="text-truncate">{{ name.givenName + ' ' + name.familyName }}</span>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { UserWithNameAndProject } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'

export default defineComponent({
  name: 'UserSelector',
  data() {
    return { APP_DATA: APP_LOADER.data }
  },
  components: {},
  props: {
    modelValue: { type: Object as PropType<UserWithNameAndProject> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: UserWithNameAndProject[], search: string): UserWithNameAndProject[] {
      return options.filter((option) => {
        const givenName = option.name.givenName.toLowerCase().indexOf(search.toLowerCase()) > -1
        if (givenName) {
          return givenName
        }
        const familyName = option.name.familyName.toLowerCase().indexOf(search.toLowerCase()) > -1
        if (familyName) {
          return familyName
        }
        return `${option.name.givenName} ${option.name.familyName}`.toLowerCase().indexOf(search.toLowerCase()) > -1
      })
    }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
