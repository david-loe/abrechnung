<template>
  <v-select
    v-if="APP_DATA"
    :options="APP_DATA.healthInsurances"
    :modelValue="props.modelValue"
    :placeholder="props.placeholder"
    @update:modelValue="updateInsurance"
    :filter="filter"
    :getOptionKey="(option: HealthInsurance<string>) => option._id"
    :getOptionLabel="(option: HealthInsurance<string>) => option.name"
    :disabled="props.disabled"
    style="min-width: 160px">
    <template #option="{ name }">
      <span>{{ name }}</span>
    </template>
    <template #selected-option="{ name }">
      <span class="text-truncate">{{ name }}</span>
    </template>
    <template v-if="props.required" #search="{ attributes, events }">
      <input class="vs__search" :required="!props.modelValue" v-bind="attributes" v-on="events" />
    </template>
  </v-select>
</template>

<script lang="ts" setup>
import { HealthInsurance, User } from 'abrechnung-common/types.js'
import { defineEmits, defineProps, onMounted, PropType } from 'vue'
import API from '@/api.js'
import APP_LOADER from '@/dataLoader.js'

const APP_DATA = APP_LOADER.data

const props = defineProps({
  modelValue: { type: Object as PropType<HealthInsurance<string>> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  updateUserInsurance: { type: Boolean, default: false }
})
const emit = defineEmits<{ 'update:modelValue': [HealthInsurance<string>] }>()

function filter(options: HealthInsurance<string>[], search: string): HealthInsurance<string>[] {
  return options.filter((option) => option.name.toLowerCase().indexOf(search.toLowerCase()) > -1)
}
function updateInsurance(insurance: HealthInsurance<string>) {
  if (props.updateUserInsurance && APP_DATA.value) {
    APP_DATA.value.user.settings.insurance = insurance
    API.setter('user/settings', { insurance } as Partial<User['settings']>, {}, false)
  }
  emit('update:modelValue', insurance)
}
onMounted(() => {
  if (props.updateUserInsurance) {
    if (APP_DATA.value?.user.settings.insurance) {
      emit('update:modelValue', APP_DATA.value.user.settings.insurance)
    }
  }
})

await APP_LOADER.loadData()
</script>

<style></style>
