<template>
  <form @submit.prevent="disabled ? null : mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="row mb-3">
      <div class="col">
        <label for="startDateInput" class="form-label">{{ $t('labels.departure') }}<span class="text-danger">*</span></label>
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
        <label for="endDateInput" class="form-label"> {{ $t('labels.arrival') }}<span class="text-danger">*</span> </label>
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

    <div class="row mb-3">
      <div class="col">
        <label for="stageFormStartLocation" class="form-label"> {{ $t('labels.startLocation') }}<span class="text-danger">*</span> </label>
        <PlaceInput id="stageFormStartLocation" v-model="formStage.startLocation" :disabled="disabled" :required="true"> </PlaceInput>
      </div>
      <div class="col">
        <label for="stageFormEndLocation" class="form-label"> {{ $t('labels.endLocation') }}<span class="text-danger">*</span> </label>
        <PlaceInput id="stageFormEndLocation" v-model="formStage.endLocation" :disabled="disabled" :required="true"> </PlaceInput>
      </div>
    </div>

    <label for="stageFormTransport" class="form-label"> {{ $t('labels.transport') }}<span class="text-danger">*</span> </label>
    <select class="form-select mb-3" v-model="formStage.transport" id="stageFormTransport" :disabled="disabled" required>
      <option v-for="transport of ['ownCar', 'airplane', 'shipOrFerry', 'otherTransport']" :value="transport" :key="transport">
        {{ $t('labels.' + transport) }}
      </option>
    </select>

    <template v-if="formStage.midnightCountries.length > 0">
      <label for="stageFormMidnightCountries" class="form-label me-2">
        {{ $t('labels.midnightCountries') }}<span class="text-danger">*</span>
      </label>
      <InfoPoint :text="$t('info.midnightCountries')" />
      <div class="row mb-3" id="stageFormMidnightCountries">
        <div v-for="midnightCountry of formStage.midnightCountries" class="col-auto" :key="midnightCountry.date.toString()">
          <label for="stageFormLocation" class="form-label">
            {{ datetoDateString(midnightCountry.date) }}
            {{ $t('labels.midnight') }}
          </label>
          <CountrySelector id="stageFormEndLocation" v-model="midnightCountry.country" :disabled="disabled" :required="true">
          </CountrySelector>
        </div>
      </div>
    </template>

    <template v-if="formStage.transport == 'ownCar'">
      <div class="mb-3">
        <label for="stageFormDistance" class="form-label"> {{ $t('labels.distance') }}<span class="text-danger">*</span> </label>
        <input type="number" class="form-control" v-model="formStage.distance" id="stageFormDistance" :disabled="disabled" required />
      </div>
      <div class="mb-3" v-if="showVehicleRegistration">
        <label for="stageFormVehicleRegistration" class="form-label me-2">
          {{ $t('labels.vehicleRegistration') }}
          <span class="text-danger">*</span>
        </label>
        <InfoPoint :text="$t('info.vehicleRegistration')" />
        <FileUpload
          ref="fileUpload"
          id="stageFormVehicleRegistration"
          v-model="$root.user.vehicleRegistration"
          @update:model-value="vehicleRegistrationChanged = true"
          :disabled="disabled"
          :required="true"
          :endpointPrefix="endpointPrefix" />
      </div>
    </template>

    <template v-if="formStage.transport !== 'ownCar'">
      <div class="row mb-2">
        <div class="col">
          <label for="stageFormCost" class="form-label me-2">
            {{ $t('labels.cost') }}
          </label>
          <InfoPoint :text="$t('info.cost')" />
          <div class="input-group" id="stageFormCost">
            <input type="number" class="form-control" step="0.01" v-model="formStage.cost.amount" min="0" :disabled="disabled" />
            <CurrencySelector v-model="formStage.cost.currency" :disabled="disabled" :required="true"></CurrencySelector>
          </div>
        </div>
        <div class="col">
          <label for="invoiceDateInput" class="form-label">
            {{ $t('labels.invoiceDate') }}<span v-if="formStage.cost.amount" class="text-danger">*</span>
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

    <template v-if="formStage.transport !== 'ownCar' || (formStage.transport == 'ownCar' && formStage.cost.receipts.length > 0)">
      <div class="mb-3">
        <label for="stageFormFile" class="form-label me-2">
          {{ $t('labels.receipts') }}<span v-if="formStage.cost.amount" class="text-danger">*</span>
        </label>
        <InfoPoint :text="$t('info.receipts')" />
        <FileUpload
          ref="fileUpload"
          id="stageFormFile"
          v-model="formStage.cost.receipts"
          :disabled="disabled"
          :required="Boolean(formStage.cost.amount)"
          :endpointPrefix="endpointPrefix" />
      </div>
    </template>

    <label for="stageFormPurpose" class="form-label me-2"> {{ $t('labels.purpose') }}<span class="text-danger">*</span> </label>
    <InfoPoint :text="$t('info.purpose')" />
    <select class="form-select mb-3" v-model="formStage.purpose" id="stageFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed', 'private']" :value="purpose" :key="purpose">{{ $t('labels.' + purpose) }}</option>
    </select>

    <div class="mb-1">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.stage') }) : $t('labels.save') }}
      </button>
      <button
        type="button"
        class="btn btn-danger me-2"
        v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : $emit('deleted', formStage._id)">
        {{ $t('labels.delete') }}
      </button>
      <button type="button" class="btn btn-light" @click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import CurrencySelector from '../Elements/CurrencySelector.vue'
import CountrySelector from '../Elements/CountrySelector.vue'
import InfoPoint from '../Elements/InfoPoint.vue'
import FileUpload from '../Elements/FileUpload.vue'
import PlaceInput from '../Elements/PlaceInput.vue'
import DateInput from '../Elements/DateInput.vue'
import { getDayList, datetoDateString, datetimeToDateString } from '../../../../common/scripts.js'
import { Stage, Place, CountrySimple } from '../../../../common/types.js'
import settings from '../../../../common/settings.json'

interface FormStage extends Omit<Stage, 'startLocation' | 'endLocation' | 'midnightCountries' | '_id'> {
  startLocation?: Place
  endLocation?: Place
  midnightCountries: { date: Date; country?: CountrySimple }[]
  _id?: string
}
const defaultStage: FormStage = {
  departure: '',
  arrival: '',
  startLocation: undefined,
  endLocation: undefined,
  midnightCountries: [],
  distance: null,
  transport: 'otherTransport',
  cost: {
    amount: null,
    currency: settings.baseCurrency,
    receipts: [],
    date: ''
  },
  purpose: 'professional'
}
export default defineComponent({
  name: 'StageForm',
  components: { InfoPoint, CurrencySelector, FileUpload, PlaceInput, CountrySelector, DateInput },
  emits: ['cancel', 'edit', 'add', 'deleted', 'postVehicleRegistration'],
  props: {
    stage: {
      type: Object as PropType<Partial<Stage>>,
      default: () => structuredClone(defaultStage)
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    },
    disabled: { type: Boolean, default: false },
    travelStartDate: { type: [String, Date], required: true },
    travelEndDate: { type: [String, Date], required: true },
    showVehicleRegistration: { type: Boolean, default: true },
    endpointPrefix: { type: String, default: '' }
  },
  data() {
    return {
      formStage: structuredClone(defaultStage),
      minDate: '' as string | Date,
      maxDate: '' as string | Date,
      loading: false,
      vehicleRegistrationChanged: false
    }
  },
  methods: {
    showMidnightCountries() {
      return (
        ['ownCar', 'otherTransport'].indexOf(this.formStage.transport) !== -1 &&
        this.formStage.startLocation &&
        this.formStage.endLocation &&
        this.formStage.startLocation.country &&
        this.formStage.endLocation.country &&
        this.formStage.startLocation.country._id != this.formStage.endLocation.country._id &&
        !isNaN(new Date(this.formStage.departure).valueOf()) &&
        !isNaN(new Date(this.formStage.arrival).valueOf()) &&
        datetimeToDateString(this.formStage.departure) !== datetimeToDateString(this.formStage.arrival)
      )
    },
    calcMidnightCountries() {
      if (this.showMidnightCountries()) {
        const newMidnightCountries = []
        const days = getDayList(this.formStage.departure, this.formStage.arrival)
        days.splice(-1, 1)
        for (const day of days) {
          newMidnightCountries.push({ date: day })
        }
        for (const oldMC of this.formStage.midnightCountries) {
          for (const newMC of newMidnightCountries) {
            if (new Date(oldMC.date).valueOf() - newMC.date.valueOf() == 0) {
              Object.assign(newMC, oldMC)
              break
            }
          }
        }
        this.formStage.midnightCountries = newMidnightCountries
      } else {
        this.formStage.midnightCountries = []
      }
    },
    clear() {
      if (this.$refs.fileUpload) {
        ;(this.$refs.fileUpload as typeof FileUpload).clear()
      }
      this.loading = false
      this.formStage = structuredClone(defaultStage)
    },
    output() {
      if (this.vehicleRegistrationChanged) {
        this.$emit('postVehicleRegistration', this.$root.user.vehicleRegistration)
      }
      this.loading = true
      if (!this.showMidnightCountries()) {
        this.formStage.midnightCountries = []
      }
      return this.formStage
    },
    input() {
      this.loading = false
      //toleranceStageDatesToApprovedTravelDates
      this.minDate = new Date(
        new Date(this.travelStartDate).valueOf() - settings.toleranceStageDatesToApprovedTravelDates * 24 * 60 * 60 * 1000
      )

      this.maxDate = new Date(
        new Date(this.travelEndDate).valueOf() + (settings.toleranceStageDatesToApprovedTravelDates + 1) * 24 * 60 * 60 * 1000 - 1
      )

      return Object.assign({}, structuredClone(defaultStage), this.stage)
    },
    datetoDateString
  },
  beforeMount() {
    this.formStage = this.input()
  },
  watch: {
    stage: function () {
      this.clear()
      this.formStage = this.input()
    },
    'formStage.transport': function () {
      this.calcMidnightCountries()
    },
    'formStage.startLocation.country': function () {
      this.calcMidnightCountries()
    },
    'formStage.endLocation.country': function () {
      this.calcMidnightCountries()
    },
    'formStage.departure': function () {
      this.calcMidnightCountries()
    },
    'formStage.arrival': function () {
      this.calcMidnightCountries()
    }
  }
})
</script>

<style></style>
