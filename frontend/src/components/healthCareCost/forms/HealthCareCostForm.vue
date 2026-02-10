<template>
  <form class="container" @submit.prevent="emit(mode as 'add', output())">
    <div v-if="!owner" class="mb-3">
      <label for="travelFormOwner" class="form-label">
        {{ t('labels.expensePayer') }}
        <span class="text-danger">*</span>
      </label>
      <UserSelector v-model="formHealthCareCost.owner" required />
    </div>

    <div class="mb-3">
      <label for="healthCareCostFormName" class="form-label">{{ t('labels.healthCareCostName') }}</label>
      <input type="text" class="form-control" id="healthCareCostFormName" v-model="formHealthCareCost.name" >
    </div>
    <div class="mb-3">
      <label for="healthCareCostFormPatient" class="form-label me-2">
        {{ t('labels.patientName') }}
        <span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.patientName')" />
      <input type="text" class="form-control" id="healthCareCostFormPatient" v-model="formHealthCareCost.patientName" required >
    </div>
    <div class="mb-3">
      <label for="healthCareCostFormInsurance" class="form-label me-2">
        {{ t('labels.insurance') }}
        <span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.insurance')" />
      <HealthInsuranceSelector v-model="formHealthCareCost.insurance" :update-user-insurance="updateUserOrg" />
    </div>
    <div class="mb-3">
      <label for="healthCareCostFormProject" class="form-label me-2">
        {{ t('labels.project') }}
        <span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.project')" />
      <ProjectSelector id="healthCareCostFormProject" v-model="formHealthCareCost.project" :update-user-org="updateUserOrg" required />
    </div>

    <div class="mb-3" v-if="APP_DATA?.settings.disableReportType.advance === false">
      <label for="healthCareCostFormAdvance" class="form-label me-2">{{ t('labels.advanceFromEmployer') }}</label>
      <InfoPoint :text="t('info.advance')" />
      <AdvanceSelector
        id="healthCareCostFormAdvance"
        v-model="formHealthCareCost.advances"
        :owner="formHealthCareCost.owner"
        :project="formHealthCareCost.project"
        :setDefault="APP_DATA.settings.autoSelectAvailableAdvances"
        :endpoint-prefix="endpointPrefix"
        multiple />
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        {{ mode === 'add' ? t('labels.addX', { X: t('labels.healthCareCost') }) : t('labels.save') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" v-on:click="emit('cancel')">{{ t('labels.cancel') }}</button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { HealthCareCostSimple, UserSimple } from 'abrechnung-common/types.js'
import { PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdvanceSelector from '@/components/elements/AdvanceSelector.vue'
import HealthInsuranceSelector from '@/components/elements/HealthInsuranceSelector.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const emit = defineEmits<{ cancel: []; edit: [Partial<HealthCareCostSimple<string>>]; add: [Partial<HealthCareCostSimple<string>>] }>()
const props = defineProps({
  healthCareCost: { type: Object as PropType<Partial<HealthCareCostSimple<string>>>, required: true },
  mode: { type: String as PropType<'add' | 'edit'>, required: true },
  owner: { type: Object as PropType<UserSimple<string>> },
  updateUserOrg: { type: Boolean, default: false },
  endpointPrefix: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})
const APP_DATA = APP_LOADER.data
const formHealthCareCost = ref(input())

function defaultHealthCareCost() {
  return { name: '', patientName: '', advances: [], owner: props.owner }
}

function output() {
  return formHealthCareCost.value
}
function input() {
  return { ...defaultHealthCareCost(), ...props.healthCareCost }
}

await APP_LOADER.loadData()

watch(
  () => props.healthCareCost,
  () => {
    formHealthCareCost.value = input()
  }
)
</script>

<style></style>
