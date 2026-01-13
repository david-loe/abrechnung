<template>
  <div>
    <span v-if="props.showPlace && props.place.place">{{ props.place.place }}&nbsp;&nbsp;</span><span
      v-if="props.showCountry"
      :title="props.place.country.name[locale as Locale]"
      >{{ props.place.country.flag }}</span
    ><span v-if="props.showSpecial && props.place.special">&nbsp;{{ '(' + props.place.special + ')' }}</span>
  </div>
</template>

<script lang="ts" setup>
import { Locale, Place } from 'abrechnung-common/types.js'
import { PropType } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const props = defineProps({
  place: { type: Object as PropType<Omit<Place, 'place'> & { place?: string }>, required: true },
  showCountry: { type: Boolean, default: true },
  showPlace: { type: Boolean, default: true },
  showSpecial: { type: Boolean, default: false }
})
</script>

<style></style>
