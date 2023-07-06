<template>
  <span>{{ place.place }}</span
  >&nbsp;<span v-if="showCountry" :title="place.country.name[$i18n.locale]">{{ place.country.flag }}</span>
</template>

<script>
export default {
  name: 'PlaceElement',
  components: {},
  props: { place: { type: Object }, showCountry: { type: Boolean, default: true } }
}
</script>

<style></style>
