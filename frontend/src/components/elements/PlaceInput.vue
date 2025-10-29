<template>
  <div>
    <div class="input-group">
      <input
        type="text"
        class="form-control"
        :value="modelValue.place"
        @input="update({ place: ($event.target as HTMLInputElement).value })"
        :placeholder="t('labels.place')"
        :disabled="disabled"
        :required="required" />
      <CountrySelector
        :modelValue="modelValue.country"
        @update:modelValue="(v) => update({ country: v })"
        :disabled="disabled"
        :required="required"></CountrySelector>
    </div>
    <div class="mt-2" v-if="withSpecialLumpSumInput && modelValue.country && APP_DATA?.specialLumpSums[modelValue.country._id]">
      <label class="form-label me-2">{{ t('labels.city') }}</label>
      <InfoPoint :text="t('info.special')" />
      <select
        class="form-select form-select-sm"
        @change="update({ special: ($event.target as HTMLInputElement).value })"
        :disabled="disabled">
        <option value=""></option>
        <option
          v-for="special of APP_DATA.specialLumpSums[modelValue.country._id]"
          :value="special"
          :key="special"
          :selected="special == modelValue.special">
          {{ special }}
        </option>
      </select>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Place } from 'abrechnung-common/types.js'
import { PropType, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'
import CountrySelector from './CountrySelector.vue'
import InfoPoint from './InfoPoint.vue'

const { t } = useI18n()

const APP_DATA = APP_LOADER.data

const props = defineProps({
  modelValue: { type: Object as PropType<Place>, default: () => ({ country: null, place: null, special: undefined }) },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  withSpecialLumpSumInput: { type: Boolean, default: false }
})
const emit = defineEmits<{ 'update:modelValue': [Place] }>()

function update(update: Partial<Place>) {
  emit('update:modelValue', Object.assign({}, props.modelValue, update))
}
function matchSpecials() {
  if (props.withSpecialLumpSumInput) {
    if (props.modelValue.country && APP_DATA.value?.specialLumpSums[props.modelValue.country._id]) {
      if (
        props.modelValue.special &&
        APP_DATA.value.specialLumpSums[props.modelValue.country._id].indexOf(props.modelValue.special) === -1
      ) {
        update({ special: undefined })
      }
      if (props.modelValue.place) {
        for (const special of APP_DATA.value.specialLumpSums[props.modelValue.country._id]) {
          if (special.toLowerCase() === props.modelValue.place.toLowerCase()) {
            update({ special: special })
            break
          }
        }
      }
    } else {
      update({ special: undefined })
    }
  }
}

watch(() => props.modelValue.country, matchSpecials)
watch(() => props.modelValue.place, matchSpecials)

await APP_LOADER.loadData()
</script>

<style></style>
