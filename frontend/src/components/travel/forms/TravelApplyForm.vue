<template>
  <form v-if="APP_DATA" class="container" @submit.prevent="emit(mode as 'add', output())">
    <div v-if="!owner" class="mb-2">
      <label for="travelFormOwner" class="form-label">
        {{ t('labels.traveler') }}
        <span class="text-danger">*</span>
      </label>
      <UserSelector v-model="formTravel.owner" required />
    </div>

    <div class="mb-2">
      <label for="travelFormName" class="form-label">{{ t('labels.travelName') }}</label>
      <input type="text" class="form-control" id="travelFormName" v-model="formTravel.name" >
    </div>

    <div class="mb-2">
      <label for="travelFormDestinationPlace" class="form-label me-2">
        {{ t('labels.destinationPlace') }}
        <span class="text-danger">*</span>
      </label>

      <InfoPoint :text="t('info.destinationPlace')" />
      <PlaceInput id="travelFormDestinationPlace" v-model="formTravel.destinationPlace" :required="true" />
    </div>

    <div class="mb-3">
      <label for="travelFormReason" class="form-label me-2">
        {{ t('labels.reason') }}
        <span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.reason')" />
      <input type="text" class="form-control" id="travelFormReason" v-model="formTravel.reason" required >
    </div>
    <template
      v-if="formTravel.destinationPlace && formTravel.destinationPlace.country && formTravel.destinationPlace.country.needsA1Certificate">
      <div class="form-check mb-3">
        <input class="form-check-input" type="checkbox" v-model="formTravel.isCrossBorder" id="travelFormIsCrossBorder" >
        <label class="form-check-label me-2" for="travelFormIsCrossBorder">{{ t('labels.isCrossBorder') }}</label>
        <InfoPoint :text="t('info.isCrossBorder')" />
      </div>
      <template v-if="formTravel.isCrossBorder && formTravel.a1Certificate">
        <div class="mb-3">
          <label for="travelFormExactAddress" class="form-label me-2">
            {{ t('labels.exactAddress') }}
            <span class="text-danger">*</span>
          </label>
          <InfoPoint :text="t('info.exactAddress')" />
          <input type="text" class="form-control" id="travelFormExactAddress" v-model="formTravel.a1Certificate.exactAddress" required >
        </div>
        <div class="mb-3">
          <label for="travelFormDestinationName" class="form-label me-2">
            {{ t('labels.destinationName') }}
            <span class="text-danger">*</span>
          </label>
          <InfoPoint :text="t('info.destinationName')" />
          <input
            type="text"
            class="form-control"
            id="travelFormDestinationName"
            v-model="formTravel.a1Certificate.destinationName"
            required >
        </div>
      </template>
    </template>

    <div class="row mb-3">
      <div class="col-auto">
        <label for="startDateInput" class="form-label">
          {{ t('labels.from') }}
          <span class="text-danger">*</span>
        </label>
        <DateInput
          id="startDateInput"
          v-model="formTravel.startDate"
          :min="APP_DATA.travelSettings.allowTravelApplicationForThePast ? undefined : minStartDate"
          required />
      </div>
      <div class="col-auto">
        <label for="endDateInput" class="form-label">
          {{ t('labels.to') }}
          <span class="text-danger">*</span>
        </label>
        <DateInput id="endDateInput" v-model="formTravel.endDate" :min="formTravel.startDate" :max="getMaxDate()" required />
      </div>
    </div>

    <template v-if="APP_DATA.travelSettings.allowSpouseRefund">
      <div class="form-check mb-3">
        <input class="form-check-input" type="checkbox" id="travelFormClaimSpouseRefund" v-model="formTravel.claimSpouseRefund" >
        <label class="form-check-label me-2" for="travelFormClaimSpouseRefund">{{ t('labels.claimSpouseRefund') }}</label>
        <InfoPoint :text="t('info.claimSpouseRefund')" />
      </div>

      <div class="mb-2">
        <label for="travelFormFellowTravelersNames" class="form-label me-2">
          {{ t('labels.fellowTravelersNames') }}
          <span v-if="formTravel.claimSpouseRefund" class="text-danger">*</span>
        </label>
        <InfoPoint :text="t('info.fellowTravelersNames')" />
        <input
          type="text"
          class="form-control"
          id="travelFormFellowTravelersNames"
          v-model="formTravel.fellowTravelersNames"
          :required="Boolean(formTravel.claimSpouseRefund)" >
      </div>
    </template>

    <div class="mb-3">
      <label for="healthCareCostFormProject" class="form-label me-2">
        {{ t('labels.project') }}
        <span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.project')" />
      <ProjectSelector id="healthCareCostFormProject" v-model="formTravel.project" :update-user-org="updateUserOrg" required />
    </div>

    <div class="mb-3" v-if="APP_DATA.settings.disableReportType.advance === false">
      <label for="travelFormAdvance" class="form-label me-2">{{ t('labels.advanceFromEmployer') }}</label>
      <InfoPoint :text="t('info.advance')" />
      <AdvanceSelector
        id="travelFormAdvance"
        v-model="formTravel.advances"
        :owner="formTravel.owner"
        :project="formTravel.project"
        :endpoint-prefix="endpointPrefix"
        :setDefault="APP_DATA.settings.autoSelectAvailableAdvances"
        multiple />
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        {{ mode === 'add' && !createNotApply
            ? t('labels.applyForX', { X: t('labels.travel') })
            : (travel.state === TravelState.REJECTED || travel.state === TravelState.APPROVED) && !createNotApply
            ? t('labels.reapplyForX', { X: t('labels.travel') })
            : t('labels.save') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" v-on:click="$emit('cancel')">{{ t('labels.cancel') }}</button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { TravelSimple, TravelState, UserSimple } from 'abrechnung-common/types.js'
import { datetimeToDateString, isValidDate } from 'abrechnung-common/utils/scripts.js'
import { PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdvanceSelector from '@/components/elements/AdvanceSelector.vue'
import DateInput from '@/components/elements/DateInput.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import PlaceInput from '@/components/elements/PlaceInput.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const emit = defineEmits<{ cancel: []; edit: [Partial<TravelSimple<string>>]; add: [Partial<TravelSimple<string>>] }>()
const props = defineProps({
  travel: { type: Object as PropType<Partial<TravelSimple<string>>>, required: true },
  mode: { type: String as PropType<'add' | 'edit'>, required: true },
  minStartDate: { type: [Date, String] as PropType<Date | string>, default: new Date() },
  owner: { type: Object as PropType<UserSimple<string>> },
  updateUserOrg: { type: Boolean, default: false },
  endpointPrefix: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  createNotApply: { type: Boolean, default: false }
})
const APP_DATA = APP_LOADER.data
const formTravel = ref(input())

function defaultTravel() {
  return {
    name: '',
    reason: '',
    startDate: '',
    endDate: '',
    destinationPlace: undefined,
    claimSpouseRefund: false,
    a1Certificate: { exactAddress: '', destinationName: '' } as TravelSimple['a1Certificate'],
    isCrossBorder: undefined,
    advances: [],
    owner: props.owner
  }
}
function output() {
  if (!formTravel.value.isCrossBorder) {
    formTravel.value.a1Certificate = undefined
  }
  return formTravel.value
}
function input() {
  return { ...defaultTravel(), ...props.travel }
}
function getMaxDate() {
  const date = isValidDate(formTravel.value.startDate as string)
  if (date && APP_DATA.value) {
    return datetimeToDateString(date.valueOf() + APP_DATA.value.travelSettings.maxTravelDayCount * 1000 * 60 * 60 * 24)
  }
  return ''
}

await APP_LOADER.loadData()
watch(
  () => props.travel,
  () => {
    formTravel.value = input()
  }
)
</script>

<style></style>
