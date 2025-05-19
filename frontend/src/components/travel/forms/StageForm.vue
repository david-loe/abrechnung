<template>
  <form v-if="APP_DATA" @submit.prevent="disabled ? null : $emit(mode, output())">
    <div class="mb-3">
      <div class="row">
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
      <div v-if="showDepartureAndArrivalOnDifferentDaysAlert" class="alert alert-warning d-flex px-2 py-1 mt-1" role="alert">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span class="ms-3">
          {{ $t('alerts.departureAndArrivalOnDifferentDaysX', { X: $t('labels.' + formStage.transport.type) }) }}
        </span>
        <button type="button" class="btn-close ms-auto" @click="showDepartureAndArrivalOnDifferentDaysAlert = false"></button>
      </div>
    </div>

    <div class="row mb-3">
      <div class="col">
        <label for="stageFormStartLocation" class="form-label"> {{ $t('labels.startLocation') }}<span class="text-danger">*</span> </label>
        <PlaceInput
          id="stageFormStartLocation"
          v-model="formStage.startLocation"
          :disabled="disabled"
          :required="true"
          :withSpecialLumpSumInput="true">
        </PlaceInput>
      </div>
      <div class="col">
        <label for="stageFormEndLocation" class="form-label"> {{ $t('labels.endLocation') }}<span class="text-danger">*</span> </label>
        <PlaceInput
          id="stageFormEndLocation"
          v-model="formStage.endLocation"
          :disabled="disabled"
          :required="true"
          :withSpecialLumpSumInput="true">
        </PlaceInput>
      </div>
    </div>

    <label for="stageFormTransport" class="form-label"> {{ $t('labels.transport') }}<span class="text-danger">*</span> </label>
    <select class="form-select mb-3" v-model="formStage.transport.type" id="stageFormTransport" :disabled="disabled" required>
      <option v-for="transport of transportTypes" :value="transport" :key="transport">
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
            {{ $formatter.simpleDate(midnightCountry.date) }}
            {{ $t('labels.midnight') }}
          </label>
          <CountrySelector id="stageFormEndLocation" v-model="midnightCountry.country" :disabled="disabled" :required="true">
          </CountrySelector>
        </div>
      </div>
    </template>

    <template v-if="formStage.transport.type == 'ownCar'">
      <div class="mb-3">
        <label for="stageFormTransport" class="form-label"> {{ $t('labels.distanceRefundType') }}<span class="text-danger">*</span> </label>
        <select
          class="form-select mb-3"
          v-model="formStage.transport.distanceRefundType"
          id="stageFormTransport"
          :disabled="disabled"
          required>
          <option v-for="distanceRefundType of distanceRefundTypes" :value="distanceRefundType" :key="distanceRefundType">
            {{
              $t('distanceRefundTypes.' + distanceRefundType) +
              ' (' +
              APP_DATA.travelSettings.distanceRefunds[distanceRefundType] +
              ' ' +
              baseCurrency.symbol +
              '/km)'
            }}
          </option>
        </select>
      </div>
      <div class="mb-3">
        <label for="stageFormDistance" class="form-label"> {{ $t('labels.distance') }}<span class="text-danger">*</span> </label>
        <a class="btn btn-link btn-sm ms-3" v-if="getGoogleMapsLink()" :href="getGoogleMapsLink()" target="_blank">
          {{ $t('labels.toX', { X: 'Google Maps' }) }}
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
      <div class="mb-3" v-if="showVehicleRegistration && APP_DATA.travelSettings.vehicleRegistrationWhenUsingOwnCar !== 'none'">
        <label for="stageFormVehicleRegistration" class="form-label me-2">
          {{ $t('labels.vehicleRegistration') }}
          <span v-if="APP_DATA.travelSettings.vehicleRegistrationWhenUsingOwnCar === 'required'" class="text-danger">*</span>
        </label>
        <InfoPoint :text="$t('info.vehicleRegistration')" />
        <FileUpload
          ref="fileUpload"
          id="stageFormVehicleRegistration"
          v-model="APP_DATA.user.vehicleRegistration as DocumentFile[] | undefined"
          @update:model-value="vehicleRegistrationChanged = true"
          :disabled="disabled"
          :required="APP_DATA.travelSettings.vehicleRegistrationWhenUsingOwnCar === 'required'"
          :endpointPrefix="endpointPrefix"
          :ownerId="ownerId" />
      </div>
    </template>

    <template v-if="formStage.transport.type !== 'ownCar'">
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

    <template
      v-if="
        formStage.transport.type !== 'ownCar' ||
        (formStage.transport.type == 'ownCar' && formStage.cost.receipts && formStage.cost.receipts.length > 0)
      ">
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
          :endpointPrefix="endpointPrefix"
          :ownerId="ownerId" />
      </div>
    </template>

    <label for="stageFormPurpose" class="form-label me-2"> {{ $t('labels.purpose') }}<span class="text-danger">*</span> </label>
    <InfoPoint :text="$t('info.purpose')" />
    <select class="form-select mb-3" v-model="formStage.purpose" id="stageFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed', 'private']" :value="purpose" :key="purpose">{{ $t('labels.' + purpose) }}</option>
    </select>

    <div class="mb-3" v-if="useDifferentProject || formStage.project">
      <label for="healthCareCostFormProject" class="form-label me-2"> {{ $t('labels.project') }}</label>
      <InfoPoint :text="$t('info.project')" />
      <button
        type="button"
        class="btn btn-sm btn-link ms-3"
        @click="
          //prettier-ignore
          useDifferentProject = false;
          formStage.project = ''
        ">
        {{ $t('labels.reset') }}
      </button>

      <ProjectSelector id="healthCareCostFormProject" v-model="formStage.project"> </ProjectSelector>
    </div>
    <div class="mb-2" v-else>
      <button type="button" class="btn btn-link ps-0" @click="useDifferentProject = true">{{ $t('labels.useDifferentProject') }}</button>
    </div>

    <div class="mb-3">
      <label for="travelFormDescription" class="form-label"> {{ $t('labels.note') }}</label>
      <TextArea class="form-control-sm" id="travelFormDescription" v-model="formStage.note" :disabled="disabled"></TextArea>
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.stage') }) : $t('labels.save') }}
      </button>
      <button
        type="button"
        class="btn btn-danger me-2"
        :disabled="loading"
        v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : $emit('deleted', formStage._id)">
        {{ $t('labels.delete') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" @click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
      <div class="ms-auto">
        <button
          type="button"
          :class="'btn btn-light' + (showPrevButton ? '' : ' invisible')"
          :title="$t('labels.previous')"
          @click="$emit('prev')">
          <i class="bi bi-chevron-left"></i>
        </button>
        <button
          type="button"
          :class="'btn btn-light ms-2' + (showNextButton ? '' : ' invisible')"
          :title="$t('labels.next')"
          @click="$emit('next')">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  </form>
</template>

<script lang="ts">
import { datetimeToDate, datetimeToDateString, getDayList } from '@/../../common/scripts.js'
import { DocumentFile, Place, Stage, baseCurrency, distanceRefundTypes, transportTypes } from '@/../../common/types.js'
import APP_LOADER from '@/appData.js'
import CountrySelector from '@/components/elements/CountrySelector.vue'
import CurrencySelector from '@/components/elements/CurrencySelector.vue'
import DateInput from '@/components/elements/DateInput.vue'
import FileUpload from '@/components/elements/FileUpload.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import PlaceInput from '@/components/elements/PlaceInput.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import TextArea from '@/components/elements/TextArea.vue'
import { PropType, defineComponent } from 'vue'

export default defineComponent({
  name: 'StageForm',
  components: { InfoPoint, CurrencySelector, FileUpload, PlaceInput, CountrySelector, DateInput, TextArea, ProjectSelector },
  emits: ['cancel', 'edit', 'add', 'deleted', 'next', 'prev', 'postVehicleRegistration'],
  props: {
    stage: {
      type: Object as PropType<Partial<Stage>>
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    },
    disabled: { type: Boolean, default: false },
    travelStartDate: { type: [String, Date], required: true },
    travelEndDate: { type: [String, Date], required: true },
    showVehicleRegistration: { type: Boolean, default: true },
    endpointPrefix: { type: String, default: '' },
    ownerId: { type: String },
    showPrevButton: { type: Boolean, default: false },
    showNextButton: { type: Boolean, default: false },
    loading: { type: Boolean, default: false }
  },
  data() {
    return {
      useDifferentProject: false,
      formStage: this.default(),
      minDate: '' as string | Date,
      maxDate: '' as string | Date,
      vehicleRegistrationChanged: false,
      showDepartureAndArrivalOnDifferentDaysAlert: false,
      APP_DATA: APP_LOADER.data,
      transportTypes,
      distanceRefundTypes,
      baseCurrency
    }
  },
  methods: {
    default() {
      return {
        departure: '',
        arrival: '',
        startLocation: undefined as Place | undefined,
        endLocation: undefined as Place | undefined,
        midnightCountries: [],
        transport: { type: 'otherTransport', distance: null, distanceRefundType: distanceRefundTypes[0] },
        cost: {
          amount: null,
          currency: baseCurrency,
          receipts: [],
          date: ''
        },
        purpose: 'professional',
        note: undefined,
        project: undefined
      }
    },
    showMidnightCountries() {
      return (
        ['ownCar', 'otherTransport'].indexOf(this.formStage.transport.type) !== -1 &&
        this.formStage.startLocation &&
        this.formStage.endLocation &&
        this.formStage.startLocation.country &&
        this.formStage.endLocation.country &&
        this.formStage.startLocation.country._id !== this.formStage.endLocation.country._id &&
        this.departureAndArrivalOnDifferentDays()
      )
    },
    departureAndArrivalOnDifferentDays() {
      return (
        !Number.isNaN(new Date(this.formStage.departure).valueOf()) &&
        !Number.isNaN(new Date(this.formStage.arrival).valueOf()) &&
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
            if (new Date(oldMC.date).valueOf() - newMC.date.valueOf() === 0) {
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
    getGoogleMapsLink() {
      if (
        this.formStage.startLocation?.place &&
        this.formStage.startLocation?.country &&
        this.formStage.endLocation?.place &&
        this.formStage.endLocation?.country
      ) {
        return `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(
          `${this.formStage.startLocation.place},${this.formStage.startLocation.country.name.en}`
        )}&destination=${encodeURIComponent(`${this.formStage.endLocation.place},${this.formStage.endLocation.country.name.en}`)}`
      }
    },
    clear() {
      if (this.$refs.fileUpload) {
        ;(this.$refs.fileUpload as typeof FileUpload).clear()
      }
      this.formStage = this.default()
      this.useDifferentProject = false
    },
    output() {
      if (this.vehicleRegistrationChanged) {
        this.$emit('postVehicleRegistration', this.APP_DATA?.user.vehicleRegistration)
      }
      if (!this.showMidnightCountries()) {
        this.formStage.midnightCountries = []
      }
      return this.formStage
    },
    input() {
      if (this.APP_DATA) {
        this.minDate = new Date(
          new Date(this.travelStartDate).valueOf() -
            this.APP_DATA.travelSettings.toleranceStageDatesToApprovedTravelDates * 24 * 60 * 60 * 1000
        )

        this.maxDate = new Date(
          new Date(this.travelEndDate).valueOf() +
            (this.APP_DATA.travelSettings.toleranceStageDatesToApprovedTravelDates + 1) * 24 * 60 * 60 * 1000 -
            1
        )
      }

      return Object.assign({}, this.default(), this.stage)
    }
  },
  async created() {
    await APP_LOADER.loadData()
    this.formStage = this.input()
  },
  watch: {
    stage: function () {
      this.clear()
      this.formStage = this.input()
    },
    'formStage.transport.type': function () {
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
      this.showDepartureAndArrivalOnDifferentDaysAlert = this.departureAndArrivalOnDifferentDays()
      // auto fill arrival when departure is set
      // departure is date object when entered manually by the user
      if (
        this.formStage.departure instanceof Date &&
        !Number.isNaN(new Date(this.formStage.departure).valueOf()) &&
        Number.isNaN(new Date(this.formStage.arrival).valueOf())
      ) {
        this.formStage.arrival = datetimeToDate(this.formStage.departure)
      }
    },
    'formStage.arrival': function () {
      this.calcMidnightCountries()
      this.showDepartureAndArrivalOnDifferentDaysAlert = this.departureAndArrivalOnDifferentDays()
    }
  }
})
</script>

<style></style>
