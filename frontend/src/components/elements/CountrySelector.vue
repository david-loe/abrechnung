<template>
  <v-select
    v-if="APP_DATA"
    :options="APP_DATA.user.settings.lastCountries.concat(APP_DATA.countries)"
    :modelValue="props.modelValue"
    :placeholder="t('labels.country')"
    @update:modelValue="(v: CountrySimple) => emits('update:modelValue', v)"
    @option:selected="setLastCountry"
    :filter="filter"
    :getOptionKey="(option: CountrySimple) => option._id"
    :getOptionLabel="(option: CountrySimple) => option.name[locale as Locale]"
    :disabled="props.disabled"
    style="min-width: 160px">
    <template #option="{ name, flag }">
      <div class="row align-items-center" :title="name[locale]">
        <div v-if="flag" class="col-auto px-1"><span class="fs-3">{{ flag }}</span></div>
        <div class="col p-1 text-truncate"><small>{{ name[locale] }}</small></div>
      </div>
    </template>
    <template #selected-option="{ _id, name, flag }">
      <div :title="name[locale]">
        <span v-if="flag" class="me-1">{{ flag }}</span>
        <span>{{ _id }}</span>
      </div>
    </template>
    <template v-if="props.required" #search="{ attributes, events }">
      <input class="vs__search" :required="!props.modelValue" v-bind="attributes" v-on="events" >
    </template>
  </v-select>
</template>

<script lang="ts" setup>
import { CountrySimple, Locale } from 'abrechnung-common/types.js'
import { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'
import { eventBus } from '../../eventBus.js'
import { setLast } from '../../helper.js'
import i18n from '../../i18n.js'

const { t, locale } = useI18n()
const APP_DATA = APP_LOADER.data
const props = defineProps({
  modelValue: { type: Object as PropType<CountrySimple> },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
const emits = defineEmits<{ 'update:modelValue': [CountrySimple] }>()

function filter(options: CountrySimple[], search: string): CountrySimple[] {
  return options.filter((option) => {
    const currentLocale = i18n.global.locale.value as Locale
    const name = option.name[currentLocale].toLowerCase().indexOf(search.toLowerCase()) > -1
    if (name) {
      return name
    }
    if (option.alias?.[currentLocale]) {
      for (const alias of option.alias[currentLocale]) {
        const result = alias.toLowerCase().indexOf(search.toLowerCase()) > -1
        if (result) {
          return result
        }
      }
    }

    const code = option._id.toLowerCase().indexOf(search.toLowerCase()) > -1
    return code
  })
}
function setLastCountry(country: CountrySimple) {
  if (APP_DATA.value) {
    setLast(country, APP_DATA.value.user.settings.lastCountries)
    eventBus.dispatchEvent(new CustomEvent('lastCountries-updated', { detail: APP_DATA.value.user.settings.lastCountries }))
  }
}

await APP_LOADER.loadData()
</script>

<style></style>
