<template>
  <form class="container" @submit.prevent="$emit('edit', output())">
    <div class="mb-3">
      <label for="userSettingsFormOrganisation" class="form-label">
        {{ $t('labels.organisation') }}<span class="text-danger">*</span>
      </label>
      <select class="form-select" id="userSettingsFormOrganisation" v-model="formUserSettings.organisation" required>
        <option v-for="organisation of organisations" :value="organisation" :key="organisation">{{ organisation }}</option>
      </select>
    </div>
    <div class="mb-3">
      <label for="userSettingsFormInsurance" class="form-label"> {{ $t('labels.insurance') }}<span class="text-danger">*</span> </label>
      <select class="form-select" id="userSettingsFormInsurance" v-model="formUserSettings.insurance" required>
        <option v-for="insurance of healthInsurances" :value="insurance.name" :key="insurance.name">{{ insurance.name }}</option>
      </select>
    </div>
    <div class="mb-2">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ $t('labels.save') }}
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
import { User } from '../../../../../common/types.js'
import { healthInsurances, organisations } from '../../../../../common/settings.json'

const defaultSettings: Partial<User['settings']> = {
  insurance: '',
  organisation: ''
}
export default defineComponent({
  name: 'UserSettingsForm',
  components: { InfoPoint },
  emits: ['cancel', 'edit'],
  props: {
    settings: {
      type: Object as PropType<Partial<User['settings']>>,
      required: true
    }
  },
  data() {
    return {
      formUserSettings: structuredClone(defaultSettings),
      loading: false,
      healthInsurances,
      organisations
    }
  },
  methods: {
    clear() {
      this.loading = false
      this.formUserSettings = structuredClone(defaultSettings)
    },
    output() {
      this.loading = true
      return this.formUserSettings
    },
    input() {
      this.loading = false
      return Object.assign({}, structuredClone(defaultSettings), this.settings)
    }
  },
  beforeMount() {
    this.formUserSettings = this.input()
  },
  watch: {
    userSettings: function () {
      this.formUserSettings = this.input()
    }
  }
})
</script>

<style></style>
