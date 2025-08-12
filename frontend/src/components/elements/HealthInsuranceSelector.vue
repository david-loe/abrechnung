<template>
  <v-select
    v-if="APP_DATA"
    :options="APP_DATA.healthInsurances"
    :modelValue="modelValue"
    :placeholder="placeholder"
    @update:modelValue="updateInsurance"
    :filter="filter"
    :getOptionKey="(option: HealthInsurance<string>) => option._id"
    :getOptionLabel="(option: HealthInsurance<string>) => option.name"
    :disabled="disabled"
    style="min-width: 160px">
    <template #option="{ name }">
      <span>{{ name }}</span>
    </template>
    <template #selected-option="{ name }">
      <span class="text-truncate">{{ name }}</span>
    </template>
    <template v-if="required" #search="{ attributes, events }">
      <input class="vs__search" :required="!modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { HealthInsurance, User } from '@/../../common/types.js'
import API from '@/api.js'
import APP_LOADER from '@/appData.js'

export default defineComponent({
  name: 'HealthInsuranceSelector',
  data() {
    return { APP_DATA: APP_LOADER.data }
  },
  props: {
    modelValue: { type: Object as PropType<HealthInsurance<string>> },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    updateUserInsurance: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  methods: {
    filter(options: HealthInsurance<string>[], search: string): HealthInsurance<string>[] {
      return options.filter((option) => option.name.toLowerCase().indexOf(search.toLowerCase()) > -1)
    },
    updateInsurance(insurance: HealthInsurance<string>) {
      if (this.updateUserInsurance && this.APP_DATA) {
        this.APP_DATA.user.settings.insurance = insurance
        API.setter('user/settings', { insurance } as Partial<User['settings']>, {}, false)
      }
      this.$emit('update:modelValue', insurance)
    }
  },
  beforeMount() {
    if (this.updateUserInsurance) {
      if (this.APP_DATA?.user.settings.insurance) {
        this.$emit('update:modelValue', this.APP_DATA.user.settings.insurance)
      }
    }
  },
  async created() {
    await APP_LOADER.loadData()
  }
})
</script>

<style></style>
