<template>
  <form class="container" @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="mb-3">
      <label for="healthCareCostFormName" class="form-label">
        {{ $t('labels.healthCareCostName') }}
      </label>
      <input type="text" class="form-control" id="healthCareCostFormName" v-model="formHealthCareCost.name" />
    </div>
    <div class="mb-3">
      <label for="healthCareCostFormPatient" class="form-label me-2">
        {{ $t('labels.patientName') }}<span class="text-danger">*</span>
      </label>
      <InfoPoint :text="$t('info.patientName')" />
      <input type="text" class="form-control" id="healthCareCostFormPatient" v-model="formHealthCareCost.patientName" required />
    </div>
    <div class="mb-3">
      <label for="healthCareCostFormInsurance" class="form-label"> {{ $t('labels.insurance') }}<span class="text-danger">*</span> </label>
      <select
        class="form-select"
        id="healthCareCostFormInsurance"
        v-model="$root.user.settings.insurance"
        @update:model-value="insuranceChanged = true"
        required>
        <option v-for="insurance of $root.healthInsurances" :value="insurance._id" :key="insurance._id">{{ insurance.name }}</option>
      </select>
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
import InfoPoint from '../../elements/InfoPoint.vue'
import { HealthCareCostSimple, Place } from '../../../../../common/types.js'

interface FormHealthCareCost extends Omit<HealthCareCostSimple, 'applicant' | 'state' | 'editor' | 'comments' | '_id' | 'refundSum'> {
  destinationPlace?: Place
}

const defaultHealthCareCost: FormHealthCareCost = {
  name: '',
  patientName: '',
  insurance: ''
}
export default defineComponent({
  name: 'HealthCareCostForm',
  components: { InfoPoint },
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
      insuranceChanged: false
    }
  },
  methods: {
    clear() {
      this.loading = false
      this.formHealthCareCost = structuredClone(defaultHealthCareCost)
    },
    output() {
      this.loading = true
      if (this.insuranceChanged) {
        this.$root.pushUserSettings(this.$root.user.settings)
      }
      this.formHealthCareCost.insurance = this.$root.user.settings.insurance!
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
