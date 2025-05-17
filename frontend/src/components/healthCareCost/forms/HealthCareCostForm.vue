<template>
  <form class="container" @submit.prevent="$emit(mode, output())">
    <div v-if="!owner" class="mb-3">
      <label for="travelFormOwner" class="form-label"> {{ $t('labels.owner') }}<span class="text-danger">*</span> </label>
      <UserSelector v-model="formHealthCareCost.owner" required></UserSelector>
    </div>

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
      <HealthInsuranceSelector v-model="formHealthCareCost.insurance" :update-user-insurance="updateUserOrg"></HealthInsuranceSelector>
    </div>
    <div class="mb-3">
      <label for="healthCareCostFormProject" class="form-label me-2"> {{ $t('labels.project') }}<span class="text-danger">*</span> </label>
      <InfoPoint :text="$t('info.project')" />
      <ProjectSelector id="healthCareCostFormProject" v-model="formHealthCareCost.project" :update-user-org="updateUserOrg" required>
      </ProjectSelector>
    </div>

    <div class="mb-3" v-if="APP_DATA?.settings.disableReportType.advance === false">
      <label for="healthCareCostFormAdvance" class="form-label me-2">
        {{ $t('labels.advanceFromEmployer') }}
      </label>
      <InfoPoint :text="$t('info.advance')" />
      <AdvanceSelector
        id="healthCareCostFormAdvance"
        v-model="formHealthCareCost.advances"
        :owner-id="idDocumentToId(formHealthCareCost.owner)"
        :project-id="formHealthCareCost.project?._id"
        :endpoint-prefix="endpointPrefix"
        multiple></AdvanceSelector>
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.healthCareCost') }) : $t('labels.save') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { HealthCareCostSimple, idDocumentToId } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import AdvanceSelector from '@/components/elements/AdvanceSelector.vue'
import HealthInsuranceSelector from '@/components/elements/HealthInsuranceSelector.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import { PropType, defineComponent } from 'vue'

export default defineComponent({
  name: 'HealthCareCostForm',
  components: { InfoPoint, ProjectSelector, UserSelector, HealthInsuranceSelector, AdvanceSelector },
  emits: ['cancel', 'edit', 'add'],
  props: {
    healthCareCost: { type: Object as PropType<Partial<HealthCareCostSimple>>, required: true },
    mode: { type: String as PropType<'add' | 'edit'>, required: true },
    owner: { type: String },
    updateUserOrg: { type: Boolean, default: false },
    endpointPrefix: { type: String, default: '' },
    loading: { type: Boolean, default: false }
  },
  data() {
    return {
      APP_DATA: APP_LOADER.data,
      formHealthCareCost: this.default()
    }
  },
  methods: {
    idDocumentToId,
    default() {
      return {
        name: '',
        patientName: '',
        advances: [],
        owner: this.owner
      }
    },
    clear() {
      this.formHealthCareCost = this.default()
    },
    output() {
      return this.formHealthCareCost
    },
    input() {
      return Object.assign({}, this.default(), this.healthCareCost)
    }
  },
  async created() {
    await APP_LOADER.loadData()
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
