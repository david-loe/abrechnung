<template>
  <v-select
    v-if="APP_DATA"
    :options="APP_DATA.user.settings.lastCurrencies.concat(APP_DATA.currencies)"
    :modelValue="props.modelValue"
    :placeholder="t('labels.currency')"
    @update:modelValue="(v: Currency) => emits('update:modelValue', v)"
    @option:selected="setLastCurrency"
    :filter="filter"
    :getOptionKey="(option: Currency) => option._id"
    :getOptionLabel="(option: Currency) => option.name[locale as Locale]"
    :disabled="props.disabled"
    style="min-width: 200px">
    <template #option="{ name, _id, symbol, flag }: Currency">
      <div class="row align-items-center">
        <div v-if="flag" class="col-auto px-1"><span class="fs-2">{{ flag }}</span></div>
        <div class="col p-1 lh-1 text-truncate" :title="name[locale as Locale]">
          <span>{{ _id }}</span>
          <br >
          <span class="text-secondary"> <small>{{ name[locale as Locale] }}</small> </span>
        </div>
        <div v-if="symbol" class="col-auto ms-auto ps-0">{{ symbol }}</div>
      </div>
    </template>
    <template #selected-option="{ name, _id, symbol, flag }: Currency">
      <div :title="name[locale as Locale]">
        <span v-if="flag" class="me-1">{{ flag }}</span>
        <span>{{ _id }}</span>
        <span v-if="symbol" class="ms-1 text-secondary">{{ symbol }}</span>
      </div>
    </template>
    <template v-if="props.required" #search="{ attributes, events }">
      <input class="vs__search" :required="!props.modelValue" v-bind="attributes" v-on="events" >
    </template>
  </v-select>
</template>

<script lang="ts" setup>
import { Currency, Locale } from 'abrechnung-common/types.js'
import { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'
import { eventBus } from '../../eventBus.js'
import { setLast } from '../../helper.js'
import i18n from '../../i18n.js'

const { t, locale } = useI18n()
const APP_DATA = APP_LOADER.data
const props = defineProps({
  modelValue: { type: Object as PropType<Currency> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emits = defineEmits<{ 'update:modelValue': [Currency] }>()

function filter(options: Currency[], search: string): Currency[] {
  return options.filter((option) => {
    const name = option.name[i18n.global.locale.value as Locale].toLowerCase().indexOf(search.toLowerCase()) > -1
    if (name) {
      return name
    }
    const code = option._id.toLowerCase().indexOf(search.toLowerCase()) > -1
    return code
  })
}
function setLastCurrency(currency: Currency) {
  if (APP_DATA.value) {
    setLast(currency, APP_DATA.value.user.settings.lastCurrencies)
    eventBus.dispatchEvent(new CustomEvent('lastCurrencies-updated', { detail: APP_DATA.value.user.settings.lastCurrencies }))
  }
}

await APP_LOADER.loadData()
</script>

<style></style>
