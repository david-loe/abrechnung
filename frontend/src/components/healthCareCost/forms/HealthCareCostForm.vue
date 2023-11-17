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
      <label for="healthCareCostFormInsurance" class="form-label me-2">
        {{ $t('labels.insurance') }}<span class="text-danger">*</span>
      </label>
      <InfoPoint :text="$t('info.insurance')" />
      <select
        class="form-select"
        id="healthCareCostFormInsurance"
        v-model="$root.user.settings.insurance"
        @update:model-value="settingsChanged = true"
        required>
        <option v-for="insurance of $root.healthInsurances" :value="insurance" :key="insurance._id">{{ insurance.name }}</option>
      </select>
    </div>
    <div class="mb-3">
      <label for="healthCareCostFormOrganisation" class="form-label me-2">
        {{ $t('labels.organisation') }}<span class="text-danger">*</span>
      </label>
      <InfoPoint :text="$t('info.organisation')" />
      <select
        class="form-select"
        id="healthCareCostFormOrganisation"
        v-model="$root.user.settings.organisation"
        @update:model-value="settingsChanged = true"
        required>
        <option v-for="organisation of $root.organisations" :value="organisation" :key="organisation._id">
          {{ organisation.name }}
        </option>
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

export default defineComponent({
  name: 'HealthCareCostForm',
  components: { InfoPoint },
  emits: ['cancel', 'edit', 'add'],
  props: {
    healthCareCost: {
      type: Object as PropType<Partial<HealthCareCostSimple>>
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    }
  },
  data() {
    return {
      formHealthCareCost: this.default(),
      loading: false,
      settingsChanged: false
    }
  },
  methods: {
    default() {
      return {
        name: '',
        patientName: ''
      }
    },
    clear() {
      this.loading = false
      this.formHealthCareCost = this.default()
      this.settingsChanged = false
    },
    output() {
      this.loading = true
      if (this.settingsChanged) {
        this.$root.pushUserSettings(this.$root.user.settings)
      }
      this.formHealthCareCost.organisation = this.$root.user.settings.organisation
      this.formHealthCareCost.insurance = this.$root.user.settings.insurance
      return this.formHealthCareCost
    },
    input() {
      this.loading = false
      return Object.assign({}, this.default(), this.healthCareCost)
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
