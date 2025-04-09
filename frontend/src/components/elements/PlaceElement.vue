<template>
  <div>
    <span v-if="showPlace && place.place">{{ place.place }}&nbsp;&nbsp;</span
    ><span v-if="showCountry" :title="place.country.name[$i18n.locale as Locale]">{{ place.country.flag }}</span
    ><span v-if="showSpecial && place.special">&nbsp;{{ '(' + place.special + ')' }}</span>
  </div>
</template>

<script lang="ts">
import { Locale, Place } from '@/../../common/types.js'
import { defineComponent, PropType } from 'vue'

export default defineComponent({
  name: 'PlaceElement',
  components: {},
  props: {
    place: { type: Object as PropType<Omit<Place, 'place'> & { place?: string }>, required: true },
    showCountry: { type: Boolean, default: true },
    showPlace: { type: Boolean, default: true },
    showSpecial: { type: Boolean, default: false }
  }
})
</script>

<style></style>
