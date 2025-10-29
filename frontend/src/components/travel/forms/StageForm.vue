<template>
  <form @submit.prevent="disabled ? null : emit(mode as 'add', output())">
    <div class="mb-3">
      <div class="row">
        <div class="col">
          <label for="startDateInput" class="form-label">{{ t('labels.departure') }}<span class="text-danger">*</span></label>
          <DateInput
            id="startDateInput"
            v-model="formStage.departure"
            :withTime="true"
            :min="minDate"
            :max="maxDate"
            :disabled="disabled"
            required />
        </div>
        <div class="col">
          <label for="endDateInput" class="form-label"> {{ t('labels.arrival') }}<span class="text-danger">*</span> </label>
          <DateInput
            id="endDateInput"
            v-model="formStage.arrival"
            :withTime="true"
            :min="formStage.departure ? formStage.departure : minDate"
            :max="maxDate"
            :disabled="disabled"
            required />
        </div>
      </div>
      <div v-if="showDepartureAndArrivalOnDifferentDaysAlert" class="alert alert-warning d-flex px-2 py-1 mt-1" role="alert">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span class="ms-3">
          {{ t('alerts.departureAndArrivalOnDifferentDaysX', { X: t('labels.' + formStage.transport.type) }) }}
        </span>
        <button type="button" class="btn-close ms-auto" @click="showDepartureAndArrivalOnDifferentDaysAlert = false"></button>
      </div>
    </div>

    <div class="row mb-3">
      <div class="col">
        <label for="stageFormStartLocation" class="form-label"> {{ t('labels.startLocation') }}<span class="text-danger">*</span> </label>
        <PlaceInput
          id="stageFormStartLocation"
          v-model="formStage.startLocation"
          :disabled="disabled"
          :required="true"
          :withSpecialLumpSumInput="true">
        </PlaceInput>
      </div>
      <div class="col">
        <label for="stageFormEndLocation" class="form-label"> {{ t('labels.endLocation') }}<span class="text-danger">*</span> </label>
        <PlaceInput
          id="stageFormEndLocation"
          v-model="formStage.endLocation"
          :disabled="disabled"
          :required="true"
          :withSpecialLumpSumInput="true">
        </PlaceInput>
      </div>
    </div>

    <label for="stageFormTransport" class="form-label"> {{ t('labels.transport') }}<span class="text-danger">*</span> </label>
    <select class="form-select mb-3" v-model="formStage.transport.type" id="stageFormTransport" :disabled="disabled" required>
      <option v-for="transport of transportTypes" :value="transport" :key="transport">
        {{ t('labels.' + transport) }}
      </option>
    </select>

    <template v-if="formStage.midnightCountries && formStage.midnightCountries.length > 0">
      <label for="stageFormMidnightCountries" class="form-label me-2">
        {{ t('labels.midnightCountries') }}<span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.midnightCountries')" />
      <div class="row mb-3" id="stageFormMidnightCountries">
        <div v-for="midnightCountry of formStage.midnightCountries" class="col-auto" :key="midnightCountry.date.toString()">
          <label for="stageFormLocation" class="form-label">
            {{ formatter.simpleDate(midnightCountry.date) }}
            {{ t('labels.midnight') }}
          </label>
          <CountrySelector id="stageFormEndLocation" v-model="midnightCountry.country" :disabled="disabled" :required="true">
          </CountrySelector>
        </div>
      </div>
    </template>

    <template v-if="formStage.transport.type == 'ownCar'">
      <div class="mb-3">
        <label for="stageFormTransport" class="form-label"> {{ t('labels.distanceRefundType') }}<span class="text-danger">*</span> </label>
        <select
          class="form-select mb-3"
          v-model="formStage.transport.distanceRefundType"
          id="stageFormTransport"
          :disabled="disabled"
          required>
          <option v-for="distanceRefundType of distanceRefundTypes" :value="distanceRefundType" :key="distanceRefundType">
            {{
              t('distanceRefundTypes.' + distanceRefundType) +
              ' (' +
              props.travelSettings.distanceRefunds[distanceRefundType as DistanceRefundType] +
              ' ' +
              baseCurrency.symbol +
              '/km)'
            }}
          </option>
        </select>
      </div>
      <div class="mb-3">
        <label for="stageFormDistance" class="form-label"> {{ t('labels.distance') }}<span class="text-danger">*</span> </label>
        <a class="btn btn-link btn-sm ms-3" v-if="getGoogleMapsLink()" :href="getGoogleMapsLink()" target="_blank">
          {{ t('labels.toX', { X: 'Google Maps' }) }}
          <i class="bi bi-box-arrow-up-right"></i>
        </a>
        <input
          type="number"
          class="form-control"
          v-model="formStage.transport.distance"
          id="stageFormDistance"
          :disabled="disabled"
          required />
      </div>
      <div class="mb-3" v-if="props.vehicleRegistration && props.travelSettings.vehicleRegistrationWhenUsingOwnCar !== 'none'">
        <label for="stageFormVehicleRegistration" class="form-label me-2">
          {{ t('labels.vehicleRegistration') }}
          <span v-if="props.travelSettings.vehicleRegistrationWhenUsingOwnCar === 'required'" class="text-danger">*</span>
        </label>
        <InfoPoint :text="t('info.vehicleRegistration')" />
        <FileUpload
          ref="fileUpload"
          id="stageFormVehicleRegistration"
          :model-value="props.vehicleRegistration"
          @update:model-value="(f: DocumentFile<string>[]) => emit('update:vehicleRegistration', f)"
          :disabled="disabled"
          :required="props.travelSettings.vehicleRegistrationWhenUsingOwnCar === 'required'"
          :endpointPrefix="endpointPrefix"
          :ownerId="ownerId"
          :showUploadFromPhone="props.showUploadFromPhone" />
      </div>
    </template>

    <template v-if="formStage.transport.type !== 'ownCar'">
      <div class="row mb-2">
        <div class="col">
          <label for="stageFormCost" class="form-label me-2">
            {{ t('labels.cost') }}
          </label>
          <InfoPoint :text="t('info.cost')" />
          <div class="input-group" id="stageFormCost">
            <input type="number" class="form-control" step="0.01" v-model="formStage.cost.amount" min="0" :disabled="disabled" />
            <CurrencySelector v-model="formStage.cost.currency" :disabled="disabled" :required="true"></CurrencySelector>
          </div>
        </div>
        <div class="col">
          <label for="invoiceDateInput" class="form-label">
            {{ t('labels.invoiceDate') }}<span v-if="formStage.cost.amount" class="text-danger">*</span>
          </label>
          <DateInput
            id="invoiceDateInput"
            v-model="formStage.cost.date"
            :required="Boolean(formStage.cost.amount)"
            :disabled="disabled"
            :max="new Date()" />
        </div>
      </div>
    </template>

    <template
      v-if="
        formStage.transport.type !== 'ownCar' ||
        (formStage.transport.type == 'ownCar' && formStage.cost.receipts && formStage.cost.receipts.length > 0)
      ">
      <div class="mb-3">
        <label for="stageFormFile" class="form-label me-2">
          {{ t('labels.receipts') }}<span v-if="formStage.cost.amount" class="text-danger">*</span>
        </label>
        <InfoPoint :text="t('info.receipts')" />
        <FileUpload
          ref="fileUpload"
          id="stageFormFile"
          v-model="formStage.cost.receipts"
          :disabled="disabled"
          :required="Boolean(formStage.cost.amount)"
          :endpointPrefix="endpointPrefix"
          :ownerId="ownerId"
          :showUploadFromPhone="props.showUploadFromPhone" />
      </div>
    </template>

    <label for="stageFormPurpose" class="form-label me-2"> {{ t('labels.purpose') }}<span class="text-danger">*</span> </label>
    <InfoPoint :text="t('info.purpose')" />
    <select class="form-select mb-3" v-model="formStage.purpose" id="stageFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed', 'private']" :value="purpose" :key="purpose">{{ t('labels.' + purpose) }}</option>
    </select>

    <template v-if="props.showProjectSelection">
      <div class="mb-3" v-if="useDifferentProject || formStage.project">
      <label for="healthCareCostFormProject" class="form-label me-2"> {{ t('labels.project') }}</label>
      <InfoPoint :text="t('info.project')" />
      <button
        type="button"
        class="btn btn-sm btn-link ms-3"
        @click="
          //prettier-ignore
          useDifferentProject = false;
          //@ts-ignore using empty string to reset project as multipart/form-data doesn't sends null
          formStage.project = ''
        ">
        {{ t('labels.reset') }}
      </button>
      <ProjectSelector id="healthCareCostFormProject" v-model="formStage.project"> </ProjectSelector>
    </div>
    <div class="mb-2" v-else>
      <button type="button" class="btn btn-link ps-0" @click="useDifferentProject = true">{{ t('labels.useDifferentProject') }}</button>
    </div>
    </template>
    

    <div class="mb-3">
      <label for="travelFormDescription" class="form-label"> {{ t('labels.note') }}</label>
      <TextArea class="form-control-sm" id="travelFormDescription" v-model="formStage.note" :disabled="disabled"></TextArea>
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">
        {{ mode === 'add' ? t('labels.addX', { X: t('labels.stage') }) : t('labels.save') }}
      </button>
      <button
        type="button"
        class="btn btn-danger me-2"
        :disabled="loading"
        v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : $emit('deleted', formStage._id)">
        {{ t('labels.delete') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" @click="$emit('cancel')">
        {{ t('labels.cancel') }}
      </button>
      <div class="ms-auto">
        <button
          type="button"
          :class="'btn btn-light' + (showPrevButton ? '' : ' invisible')"
          :title="t('labels.previous')"
          @click="$emit('prev')">
          <i class="bi bi-chevron-left"></i>
        </button>
        <button
          type="button"
          :class="'btn btn-light ms-2' + (showNextButton ? '' : ' invisible')"
          :title="t('labels.next')"
          @click="$emit('next')">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  </form>
</template>

<script lang="ts" setup>
import {
  baseCurrency,
  CountrySimple,
  DistanceRefundType,
  DocumentFile,
  distanceRefundTypes,
  Place,
  Stage,
  TravelSettings,
  transportTypes
} from 'abrechnung-common/types.js'
import { datetimeToDate, datetimeToDateString, getDayList } from 'abrechnung-common/utils/scripts.js'
import { computed, defineProps, PropType, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatter } from '../../../formatter'
import CountrySelector from '../../elements/CountrySelector.vue'
import CurrencySelector from '../../elements/CurrencySelector.vue'
import DateInput from '../../elements/DateInput.vue'
import FileUpload from '../../elements/FileUpload.vue'
import InfoPoint from '../../elements/InfoPoint.vue'
import PlaceInput from '../../elements/PlaceInput.vue'
import ProjectSelector from '../../elements/ProjectSelector.vue'
import TextArea from '../../elements/TextArea.vue'

const emit = defineEmits<{
  cancel: []
  edit: [Partial<Stage<string>>]
  add: [Partial<Stage<string>>]
  deleted: [string | undefined]
  next: []
  prev: []
  'update:vehicleRegistration': [DocumentFile<string>[]]
}>()
const props = defineProps({
  stage: { type: Object as PropType<Partial<Stage<string>>> },
  mode: { type: String as PropType<'add' | 'edit'>, required: true },
  disabled: { type: Boolean, default: false },
  travelStartDate: { type: [String, Date] },
  travelEndDate: { type: [String, Date] },
  vehicleRegistration: { type: Array as PropType<DocumentFile<string>[] | null> },
  travelSettings: { type: Object as PropType<TravelSettings>, required: true },
  endpointPrefix: { type: String, default: '' },
  ownerId: { type: String },
  showProjectSelection: { type: Boolean, default: true },
  showUploadFromPhone: { type: Boolean, default: true },
  showPrevButton: { type: Boolean, default: false },
  showNextButton: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const { t } = useI18n()

const fileUploadRef = useTemplateRef('fileUpload')

const useDifferentProject = ref(false)
const formStage = ref(input())
const minDate = computed(() => {
  if (props.travelStartDate) {
    const date = new Date(props.travelStartDate)
    date.setUTCDate(date.getUTCDate() - props.travelSettings.toleranceStageDatesToApprovedTravelDates)
    return date
  }
})
const maxDate = computed(() => {
  if (props.travelEndDate) {
    const date = new Date(props.travelEndDate)
    date.setUTCDate(date.getUTCDate() + 1 + props.travelSettings.toleranceStageDatesToApprovedTravelDates)
    return date
  }
})

const showDepartureAndArrivalOnDifferentDaysAlert = ref(false)

function defaultStage() {
  return {
    departure: '',
    arrival: '',
    startLocation: undefined as Place | undefined,
    endLocation: undefined as Place | undefined,
    midnightCountries: [],
    transport: { type: 'otherTransport', distance: null, distanceRefundType: distanceRefundTypes[0] },
    cost: { amount: null, currency: baseCurrency, receipts: [], date: '' },
    purpose: 'professional',
    note: undefined,
    project: undefined
  }
}
function showMidnightCountries() {
  return (
    (formStage.value.transport.type === 'ownCar' || formStage.value.transport.type === 'otherTransport') &&
    formStage.value.startLocation &&
    formStage.value.endLocation &&
    formStage.value.startLocation.country &&
    formStage.value.endLocation.country &&
    formStage.value.startLocation.country._id !== formStage.value.endLocation.country._id &&
    departureAndArrivalOnDifferentDays()
  )
}
function departureAndArrivalOnDifferentDays() {
  return (
    !Number.isNaN(new Date(formStage.value.departure).valueOf()) &&
    !Number.isNaN(new Date(formStage.value.arrival).valueOf()) &&
    datetimeToDateString(formStage.value.departure) !== datetimeToDateString(formStage.value.arrival)
  )
}
function calcMidnightCountries() {
  if (showMidnightCountries()) {
    const newMidnightCountries = []
    const days = getDayList(formStage.value.departure, formStage.value.arrival)
    days.splice(-1, 1)
    for (const day of days) {
      newMidnightCountries.push({ date: day, country: null as unknown as CountrySimple })
    }
    for (const oldMC of formStage.value.midnightCountries ?? []) {
      for (const newMC of newMidnightCountries) {
        if (new Date(oldMC.date).valueOf() - newMC.date.valueOf() === 0) {
          Object.assign(newMC, oldMC)
          break
        }
      }
    }
    formStage.value.midnightCountries = newMidnightCountries
  } else {
    formStage.value.midnightCountries = []
  }
}
function getGoogleMapsLink() {
  if (
    formStage.value.startLocation?.place &&
    formStage.value.startLocation?.country &&
    formStage.value.endLocation?.place &&
    formStage.value.endLocation?.country
  ) {
    return `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(
      `${formStage.value.startLocation.place},${formStage.value.startLocation.country.name.en}`
    )}&destination=${encodeURIComponent(`${formStage.value.endLocation.place},${formStage.value.endLocation.country.name.en}`)}`
  }
}
function clear() {
  fileUploadRef.value?.clear()
  formStage.value = defaultStage()
  useDifferentProject.value = false
}
function output() {
  if (!showMidnightCountries()) {
    formStage.value.midnightCountries = []
  }
  return formStage.value as Partial<Stage<string>>
}
function input() {
  return { ...defaultStage(), ...props.stage }
}

watch(
  () => props.stage,
  () => {
    clear()
    formStage.value = input()
  }
)
watch(() => formStage.value.transport.type, calcMidnightCountries)
watch(() => formStage.value.startLocation?.country, calcMidnightCountries)
watch(() => formStage.value.endLocation?.country, calcMidnightCountries)
watch(
  () => formStage.value.departure,
  () => {
    calcMidnightCountries()
    showDepartureAndArrivalOnDifferentDaysAlert.value = departureAndArrivalOnDifferentDays()
    // auto fill arrival when departure is set
    // departure is date object when entered manually by the user
    if (
      formStage.value.departure instanceof Date &&
      !Number.isNaN(new Date(formStage.value.departure).valueOf()) &&
      Number.isNaN(new Date(formStage.value.arrival).valueOf())
    ) {
      formStage.value.arrival = datetimeToDate(formStage.value.departure)
    }
  }
)
watch(
  () => formStage.value.arrival,
  () => {
    calcMidnightCountries()
    showDepartureAndArrivalOnDifferentDaysAlert.value = departureAndArrivalOnDifferentDays()
  }
)
</script>

<style></style>
