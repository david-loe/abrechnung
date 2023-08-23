<template>
  <div>
    <span>{{ place.place }}</span>
    &nbsp;<span v-if="showCountry" :title="place.country.name[$i18n.locale as Locale]">{{ place.country.flag }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { Locale, Place } from './../../../../common/types.js'

export default defineComponent({
  name: 'PlaceElement',
  components: {},
  props: { place: { type: Object as PropType<Place>, required: true }, showCountry: { type: Boolean, default: true } }
})
</script>

<style></style>
