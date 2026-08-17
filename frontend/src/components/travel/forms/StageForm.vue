<template>
  <form @submit.prevent="disabled ? null : emit(mode as 'add', output())">
    <template
      v-if="
        formStage.transport.type !== 'ownCar' ||
        (formStage.transport.type == 'ownCar' && formStage.cost.receipts && formStage.cost.receipts.length > 0)
      ">
      <div class="mb-3">
        <label for="stageFormFile" class="form-label me-2">
          {{ t('labels.receipts') }}
          <span v-if="hasCostAmount" class="text-danger">*</span>
        </label>
        <InfoPoint :text="t('info.receipts')" />
        <FileUpload
          ref="fileUpload"
          id="stageFormFile"
          v-model="formStage.cost.receipts"
          :disabled="disabled"
          :required="hasCostAmount"
          :endpointPrefix="endpointPrefix"
          :ownerId="ownerId"
          :report-id="reportId"
          source-report-type="Travel"
          :suggestion-failed="suggestionFailed"
          :suggestion-processing="suggestingFromReceipts"
          receipt-processing
          @processing="(processing: boolean) => (uploadingReceipts = processing)"
          @receipts-changing="cancelReceiptSuggestion"
          @receipts-ready="suggestFromReceipts"
          :showUploadFromPhone="props.showUploadFromPhone" />
      </div>
    </template>

    <label for="stageFormTransport" class="form-label">
      {{ t('labels.transport') }}
      <span class="text-danger">*</span>
    </label>
    <select class="form-select mb-3" v-model="formStage.transport.type" id="stageFormTransport" :disabled="disabled" required @change="dirtyFields.add('transport')">
      <option v-for="transport of transportTypes" :value="transport" :key="transport">{{ t('labels.' + transport) }}</option>
    </select>

    <div class="mb-3">
      <div class="row">
        <div class="col">
          <label for="startDateInput" class="form-label">
            {{ t('labels.departure') }}
            <span class="text-danger">*</span>
          </label>
          <DateInput
            id="startDateInput"
            v-model="formStage.departure"
            :withTime="true"
            :min="minDate"
            :max="maxDate"
            :disabled="disabled"
            @update:model-value="dirtyFields.add('departure')"
            required />
        </div>
        <div class="col">
          <label for="endDateInput" class="form-label">
            {{ t('labels.arrival') }}
            <span class="text-danger">*</span>
          </label>
          <DateInput
            id="endDateInput"
            v-model="formStage.arrival"
            :withTime="true"
            :min="formStage.departure ? formStage.departure : minDate"
            :max="maxDate"
            :disabled="disabled"
            @update:model-value="dirtyFields.add('arrival')"
            required />
        </div>
      </div>
      <div v-if="showDepartureAndArrivalOnDifferentDaysAlert" class="alert alert-warning d-flex px-2 py-1 mt-1" role="alert">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span class="ms-3"> {{ t('alerts.departureAndArrivalOnDifferentDaysX', { X: t('labels.' + formStage.transport.type) }) }}</span>
        <button type="button" class="btn-close ms-auto" @click="showDepartureAndArrivalOnDifferentDaysAlert = false"></button>
      </div>
    </div>

    <div class="row mb-3">
      <div class="col">
        <label for="stageFormStartLocation" class="form-label">
          {{ t('labels.startLocation') }}
          <span class="text-danger">*</span>
        </label>
        <PlaceInput
          id="stageFormStartLocation"
          v-model="formStage.startLocation"
          :disabled="disabled"
          :required="true"
          @update:model-value="dirtyFields.add('startLocation')"
          :withSpecialLumpSumInput="true" />
      </div>
      <div class="col">
        <label for="stageFormEndLocation" class="form-label">
          {{ t('labels.endLocation') }}
          <span class="text-danger">*</span>
        </label>
        <PlaceInput
          id="stageFormEndLocation"
          v-model="formStage.endLocation"
          :disabled="disabled"
          :required="true"
          @update:model-value="dirtyFields.add('endLocation')"
          :withSpecialLumpSumInput="true" />
      </div>
    </div>

    <template v-if="formStage.midnightCountries && formStage.midnightCountries.length > 0">
      <label for="stageFormMidnightCountries" class="form-label me-2">
        {{ t('labels.midnightCountries') }}
        <span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.midnightCountries')" />
      <div class="row mb-3" id="stageFormMidnightCountries">
        <div v-for="midnightCountry of formStage.midnightCountries" class="col-auto" :key="midnightCountry.date.toString()">
          <label for="stageFormLocation" class="form-label">
            {{ formatter.simpleDate(midnightCountry.date) }}
            {{ t('labels.midnight') }}
          </label>
          <CountrySelector id="stageFormEndLocation" v-model="midnightCountry.country" :disabled="disabled" :required="true" />
        </div>
      </div>
    </template>

    <template v-if="formStage.transport.type == 'ownCar'">
      <div class="mb-3">
        <label for="stageFormTransport" class="form-label">
          {{ t('labels.distanceRefundType') }}
          <span class="text-danger">*</span>
        </label>
        <select
          class="form-select mb-3"
          v-model="formStage.transport.distanceRefundType"
          id="stageFormTransport"
          :disabled="disabled"
          required>
          <option v-for="distanceRefundType of distanceRefundTypes" :value="distanceRefundType" :key="distanceRefundType">
            {{ t('distanceRefundTypes.' + distanceRefundType) +
              ' (' +
              props.travelSettings.distanceRefunds[distanceRefundType as DistanceRefundType] +
              ' ' +
              baseCurrency.symbol +
              '/km)' }}
          </option>
        </select>
      </div>
      <div class="mb-3">
        <label for="stageFormDistance" class="form-label">
          {{ t('labels.distance') }}
          <span class="text-danger">*</span>
        </label>
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
          required >
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
          :report-id="reportId"
          source-report-type="Travel"
          :showUploadFromPhone="props.showUploadFromPhone" />
      </div>
    </template>

    <template v-if="formStage.transport.type !== 'ownCar'">
      <div class="row mb-2">
        <div class="col">
          <label for="stageFormCurrency" class="form-label me-2">{{ t('labels.currency') }}</label>
          <CurrencySelector id="stageFormCurrency" v-model="formStage.cost.currency" :disabled="disabled" :required="true" @update:model-value="dirtyFields.add('currency')" />
        </div>
        <div class="col">
          <label for="invoiceDateInput" class="form-label">
            {{ t('labels.invoiceDate') }}
            <span v-if="hasCostAmount" class="text-danger">*</span>
          </label>
          <DateInput
            id="invoiceDateInput"
            :model-value="formStage.cost.date || undefined"
            @update:model-value="(date) => { formStage.cost.date = date; dirtyFields.add('date') }"
            :required="hasCostAmount"
            :disabled="disabled"
            :max="new Date()" />
        </div>
      </div>
    </template>

    <CostPositionsEditor
      v-model="formStage.cost.positions"
      :default-project="defaultProject"
      report-type="Travel"
      :currency="formStage.cost.currency"
      :disabled="disabled"
      :required="true"
      :amount-required="false"
      :require-single-position-description="false"
      @user-change="dirtyFields.add('positions')"
      :own-car="formStage.transport.type === 'ownCar'" />

    <label for="stageFormPurpose" class="form-label me-2">
      {{ t('labels.purpose') }}
      <span class="text-danger">*</span>
    </label>
    <InfoPoint :text="t('info.purpose')" />
    <select class="form-select mb-3" v-model="formStage.purpose" id="stageFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed', 'private']" :value="purpose" :key="purpose">{{ t('labels.' + purpose) }}</option>
    </select>

    <div class="mb-3">
      <label for="travelFormDescription" class="form-label">{{ t('labels.note') }}</label>
      <CTextArea class="form-control-sm" id="travelFormDescription" v-model="formStage.note" :disabled="disabled" />
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading || uploadingReceipts">
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
      <button type="button" class="btn btn-light" @click="$emit('cancel')">{{ t('labels.cancel') }}</button>
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
  Category,
  CostPosition,
  CountrySimple,
  DistanceRefundType,
  DocumentFile,
  distanceRefundTypes,
  Place,
  ProjectSimple,
  Stage,
  TravelSettings,
  transportTypes
} from 'abrechnung-common/types.js'
import { datetimeToDate, datetimeToDateString, getDayList, multiplyAmountAndRound } from 'abrechnung-common/utils/scripts.js'
import { computed, nextTick, PropType, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatter } from '../../../formatter'
import CountrySelector from '../../elements/CountrySelector.vue'
import CurrencySelector from '../../elements/CurrencySelector.vue'
import CostPositionsEditor from '../../elements/CostPositionsEditor.vue'
import DateInput from '../../elements/DateInput.vue'
import FileUpload from '../../elements/FileUpload.vue'
import APP_LOADER from '@/dataLoader.js'
import { applySuggestedCost, receiptIds, requestReceiptSuggestion, suggestedPlace } from '@/receiptSuggestions.js'
import InfoPoint from '../../elements/InfoPoint.vue'
import PlaceInput from '../../elements/PlaceInput.vue'
import CTextArea from '../../elements/TextArea.vue'

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
  reportId: { type: String },
  showProjectSelection: { type: Boolean, default: true },
  showUploadFromPhone: { type: Boolean, default: true },
  showPrevButton: { type: Boolean, default: false },
  showNextButton: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  defaultProject: { type: Object as PropType<ProjectSimple<string>>, required: true }
})

const { t } = useI18n()
const APP_DATA = APP_LOADER.data

const fileUploadRef = useTemplateRef('fileUpload')

const dirtyFields = new Set<string>()
const uploadingReceipts = ref(false)
const suggestingFromReceipts = ref(false)
const suggestionFailed = ref(false)
let suggestionGeneration = 0
const formStage = ref(input())
const hasCostAmount = computed(() =>
  formStage.value.cost.positions.some(({ grossAmount }) => Number.isFinite(grossAmount) && grossAmount !== 0)
)
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

protectExistingValues()

function defaultCostPosition(position?: CostPosition<string>) {
  return {
    ...(position?._id ? { _id: position._id } : {}),
    kind: 'manual' as const,
    description: '',
    grossAmount: 0,
    vatRate: 0,
    project: position?.project ?? props.defaultProject,
    category: position?.category as Category<string>
  }
}

function defaultStage() {
  return {
    departure: '',
    arrival: '',
    startLocation: undefined as Place | undefined,
    endLocation: undefined as Place | undefined,
    midnightCountries: [],
    transport: { type: 'otherTransport', distance: null, distanceRefundType: distanceRefundTypes[0] },
    cost: { positions: [defaultCostPosition()], currency: baseCurrency, receipts: [], date: '' },
    purpose: 'professional',
    note: undefined
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
  cancelReceiptSuggestion()
  dirtyFields.clear()
  formStage.value = defaultStage()
}
function cancelReceiptSuggestion() {
  suggestionGeneration += 1
  suggestingFromReceipts.value = false
  suggestionFailed.value = false
}
function output() {
  for (const position of formStage.value.cost.positions) {
    if (!Number.isFinite(position.grossAmount)) position.grossAmount = 0
  }
  if (!showMidnightCountries()) {
    formStage.value.midnightCountries = []
  }
  return formStage.value as Partial<Stage<string>>
}
function input() {
  const stage = { ...defaultStage(), ...props.stage }
  if (stage.transport?.type !== 'ownCar' && stage.cost.positions.length === 0) {
    stage.cost.positions = [defaultCostPosition()]
  }
  return stage
}

function protectExistingValues() {
  dirtyFields.clear()
  if (!props.stage?._id) return
  if (props.stage.departure) dirtyFields.add('departure')
  if (props.stage.arrival) dirtyFields.add('arrival')
  if (props.stage.startLocation) dirtyFields.add('startLocation')
  if (props.stage.endLocation) dirtyFields.add('endLocation')
  if (props.stage.transport) dirtyFields.add('transport')
  if (props.stage.cost?.currency) dirtyFields.add('currency')
  if (props.stage.cost?.date) dirtyFields.add('date')
  if (props.stage.cost?.positions?.length) dirtyFields.add('positions')
}

async function suggestFromReceipts() {
  const generation = ++suggestionGeneration
  suggestingFromReceipts.value = true
  suggestionFailed.value = false
  try {
    const position = formStage.value.cost.positions[0]
    const suggestion = await requestReceiptSuggestion({
      type: 'stage',
      reportType: 'Travel',
      projectId: position?.project?._id ?? props.defaultProject._id,
      documentFileIds: receiptIds(formStage.value.cost.receipts),
      reportId: props.reportId,
      sourceReportType: 'Travel',
      endpointPrefix: props.endpointPrefix
    })
    if (generation !== suggestionGeneration || suggestion?.type !== 'stage' || !APP_DATA.value) return
    if (!dirtyFields.has('departure') && !formStage.value.departure && suggestion.departure) formStage.value.departure = suggestion.departure
    if (!dirtyFields.has('arrival') && !formStage.value.arrival && suggestion.arrival) formStage.value.arrival = suggestion.arrival
    if (!dirtyFields.has('startLocation') && !formStage.value.startLocation) {
      formStage.value.startLocation = suggestedPlace(suggestion.startLocation, APP_DATA.value.countries)
    }
    if (!dirtyFields.has('endLocation') && !formStage.value.endLocation) {
      formStage.value.endLocation = suggestedPlace(suggestion.endLocation, APP_DATA.value.countries)
    }
    if (!dirtyFields.has('transport') && formStage.value.transport.type === 'otherTransport' && suggestion.transportType) {
      formStage.value.transport =
        suggestion.transportType === 'ownCar'
          ? { type: 'ownCar', distance: 0, distanceRefundType: distanceRefundTypes[0] }
          : { type: suggestion.transportType }
      await nextTick()
    }
    if (formStage.value.transport.type !== 'ownCar') {
      applySuggestedCost(formStage.value.cost, suggestion.cost, {
        categories: APP_DATA.value.categories,
        currencies: APP_DATA.value.currencies,
        defaultProject: props.defaultProject,
        dirty: dirtyFields,
        reportType: 'Travel'
      })
    }
  } catch {
    if (generation === suggestionGeneration) suggestionFailed.value = true
  } finally {
    if (generation === suggestionGeneration) suggestingFromReceipts.value = false
  }
}

watch(
  () => props.stage,
  () => {
    clear()
    formStage.value = input()
    protectExistingValues()
  }
)
watch(
  () => formStage.value.transport.type,
  (transportType) => {
    calcMidnightCountries()
    if (transportType === 'ownCar') {
      const oldPosition = formStage.value.cost.positions[0]
      formStage.value.cost.positions = [
        {
          ...(oldPosition?._id ? { _id: oldPosition._id } : {}),
          kind: 'ownCar',
          grossAmount: 0,
          vatRate: 0,
          project: oldPosition?.project ?? props.defaultProject,
          category: oldPosition?.category
        }
      ]
      formStage.value.cost.currency = baseCurrency
    } else if (formStage.value.cost.positions.some(({ kind }) => kind === 'ownCar')) {
      formStage.value.cost.positions = [defaultCostPosition(formStage.value.cost.positions[0])]
    }
  }
)
watch(
  [
    () => (formStage.value.transport.type === 'ownCar' ? formStage.value.transport.distance : 0),
    () => (formStage.value.transport.type === 'ownCar' ? formStage.value.transport.distanceRefundType : distanceRefundTypes[0])
  ],
  ([distance, refundType]) => {
    const position = formStage.value.cost.positions.find(({ kind }) => kind === 'ownCar')
    if (position && refundType) position.grossAmount = multiplyAmountAndRound(distance || 0, props.travelSettings.distanceRefunds[refundType])
  }
)
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
