<template>
  <v-select
    v-if="$root.users.length > 0"
    :options="$root.users"
    :modelValue="modelValue"
    :placeholder="$t('labels.owner')"
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
import { defineComponent } from 'vue'
import { User } from '../../../../common/types.js'

interface UserWithName {
  name: User['name']
  _id: string
}
export default defineComponent({
  name: 'CountrySelector',
  data() {
    return {}
  },
  components: {},
  props: {
    modelValue: { type: String },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: UserWithName[], search: string): UserWithName[] {
      return options.filter((option) => {
        const givenName = option.name.givenName.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
        if (givenName) {
          return givenName
        }
        const familyName = option.name.familyName.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
        if (familyName) {
          return familyName
        }
        return (option.name.givenName + ' ' + option.name.familyName).toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) > -1
      })
    }
  }
})
</script>

<style></style>
