<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="mb-3">
      <label for="healthCareCostFormName" class="form-label">
        {{ $t('labels.healthCareCostName') }}
      </label>
      <input type="text" class="form-control" id="healthCareCostFormName" v-model="formHealthCareCost.name" />
    </div>
    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.healthCareCost') }) : $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import CurrencySelector from '../../elements/CurrencySelector.vue'
import InfoPoint from '../../elements/InfoPoint.vue'
import PlaceInput from '../../elements/PlaceInput.vue'
import DateInput from '../../elements/DateInput.vue'
import { HealthCareCostSimple, Place } from '../../../../../common/types.js'
import settings from '../../../../../common/settings.json'

interface FormHealthCareCost extends Omit<HealthCareCostSimple, 'expensePayer' | 'state' | 'editor' | 'comments' | '_id'> {
  destinationPlace?: Place
}

const defaultHealthCareCost: FormHealthCareCost = {
  name: ''
}
export default defineComponent({
  name: 'HealthCareCostForm',
  components: { CurrencySelector, InfoPoint, PlaceInput, DateInput },
  emits: ['cancel', 'edit', 'add'],
  props: {
    healthCareCost: {
      type: Object as PropType<Partial<HealthCareCostSimple>>,
      default: () => structuredClone(defaultHealthCareCost)
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    }
  },
  data() {
    return {
      formHealthCareCost: structuredClone(defaultHealthCareCost),
      loading: false,
      settings
    }
  },
  methods: {
    clear() {
      this.loading = false
      this.formHealthCareCost = structuredClone(defaultHealthCareCost)
    },
    output() {
      this.loading = true
      return this.formHealthCareCost
    },
    input() {
      this.loading = false
      return Object.assign({}, structuredClone(defaultHealthCareCost), this.healthCareCost)
    }
  },
  beforeMount() {
    this.formHealthCareCost = this.input()
  },
  watch: {
    healthCareCost: function () {
      this.formHealthCareCost = this.input()
    }
  }
})
</script>

<style></style>
