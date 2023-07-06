<template>
  <div class="input-group">
    <input
      type="text"
      class="form-control"
      :value="modelValue.place"
      @input="$emit('update:modelValue', Object.assign({}, modelValue, { place: $event.target.value }))"
      :placeholder="$t('labels.place')"
      :disabled="disabled"
      :required="required" />
    <CountrySelector
      :modelValue="modelValue.country"
      @update:modelValue="(v) => $emit('update:modelValue', Object.assign({}, modelValue, { country: v }))"
      :disabled="disabled"
      :required="required"></CountrySelector>
  </div>
</template>

<script>
import CountrySelector from './CountrySelector.vue'
const defaultPlace = {
  country: null,
  place: null
}
export default {
  name: 'PlaceInput',
  data() {
    return {}
  },
  components: { CountrySelector },
  props: {
    modelValue: { type: Object, default: () => defaultPlace },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  beforeMount() {},
  mounted() {}
}
</script>

<style></style>
