<template>
  <v-select
    v-if="APP_DATA?.users"
    :options="APP_DATA.users"
    :modelValue="modelValue"
    :placeholder="placeholder"
    @update:modelValue="(_id: string) => $emit('update:modelValue', _id)"
    :reduce="(u: UserWithName) => u._id"
    :filter="filter"
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
import APP_LOADER, { APP_DATA } from '@/appData.js'
import { defineComponent, PropType } from 'vue'
import { User } from '../../../../common/types.js'

interface UserWithName {
  name: User['name']
  _id: string
}
export default defineComponent({
  name: 'UserSelector',
  data() {
    return { APP_DATA: null as APP_DATA | null }
  },
  components: {},
  props: {
    modelValue: { type: String as PropType<string | null> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: UserWithName[], search: string): UserWithName[] {
      return options.filter((option) => {
        const givenName = option.name.givenName.toLowerCase().indexOf(search.toLowerCase()) > -1
        if (givenName) {
          return givenName
        }
        const familyName = option.name.familyName.toLowerCase().indexOf(search.toLowerCase()) > -1
        if (familyName) {
          return familyName
        }
        return (option.name.givenName + ' ' + option.name.familyName).toLowerCase().indexOf(search.toLowerCase()) > -1
      })
    }
  },
  created() {
    APP_LOADER.loadData().then((APP_DATA) => (this.APP_DATA = APP_DATA))
  }
})
</script>

<style></style>
