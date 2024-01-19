<template>
  <div>
    <div class="input-group">
      <input
        type="text"
        class="form-control"
        :value="modelValue.place"
        @input="update({ place: ($event.target as HTMLInputElement).value })"
        :placeholder="$t('labels.place')"
        :disabled="disabled"
        :required="required" />
      <CountrySelector
        :modelValue="modelValue.country"
        @update:modelValue="(v) => update({ country: v })"
        :disabled="disabled"
        :required="required"></CountrySelector>
    </div>
    <div class="mt-2" v-if="withSpecialLumpSumInput && modelValue.country && $root.specialLumpSums[modelValue.country._id]">
      <label class="form-label me-2">{{ $t('labels.city') }}</label>
      <InfoPoint :text="$t('info.special')" />
      <select
        class="form-select form-select-sm"
        @change="update({ special: ($event.target as HTMLInputElement).value })"
        :disabled="disabled">
        <option value=""></option>
        <option
          v-for="special of $root.specialLumpSums[modelValue.country._id]"
          :value="special"
          :key="special"
          :selected="special == modelValue.special">
          {{ special }}
        </option>
      </select>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { Place } from '../../../../common/types.js'
import CountrySelector from './CountrySelector.vue'
import InfoPoint from './InfoPoint.vue'

const defaultPlace = {
  country: null,
  place: null,
  special: undefined
}
export default defineComponent({
  name: 'PlaceInput',
  data() {
    return {}
  },
  components: { CountrySelector, InfoPoint },
  props: {
    modelValue: { type: Object as PropType<Place>, default: () => defaultPlace },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    withSpecialLumpSumInput: { type: Boolean, default: false }
  },
  emits: ['update:modelValue'],
  methods: {
    update(update: Partial<Place>) {
      this.$emit('update:modelValue', Object.assign({}, this.modelValue, update))
    },
    matchSpecials() {
      if (this.withSpecialLumpSumInput) {
        if (this.modelValue.country && this.$root.specialLumpSums[this.modelValue.country._id]) {
          if (this.modelValue.special && this.$root.specialLumpSums[this.modelValue.country._id].indexOf(this.modelValue.special) === -1) {
            this.update({ special: undefined })
          }
          for (const special of this.$root.specialLumpSums[this.modelValue.country._id]) {
            if (special === this.modelValue.place) {
              this.update({ special: special })
              break
            }
          }
        } else {
          this.update({ special: undefined })
        }
      }
    }
  },
  watch: {
    'modelValue.country': function () {
      this.matchSpecials()
    },
    'modelValue.place': function () {
      this.matchSpecials()
    }
  }
})
</script>

<style></style>
