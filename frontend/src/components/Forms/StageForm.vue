<template>
  <form @submit.prevent="disabled ? null : (mode === 'add' ? $emit('add', output()) : $emit('edit', output()))">

    <div class="row mb-3">
      <div class="col">
        <label for="startDateInput" class="form-label">{{ $t('labels.departure') }}</label>
        <input id="startDateInput" class="form-control" type="datetime-local" v-model="formStage.departure" :min="minDate"
          :max="maxDate" :disabled="disabled" required />
      </div>
      <div class="col">
        <label for="endDateInput" class="form-label">{{ $t('labels.arrival')
        }}</label>
        <input id="endDateInput" class="form-control" type="datetime-local" v-model="formStage.arrival"
          :min="formStage.departure ? formStage.departure : minDate" :max="maxDate" :disabled="disabled" required />
      </div>
    </div>


    <div class="row mb-3">
      <div class="col">
        <label for="stageFormStartLocation" class="form-label">
          {{ $t('labels.startLocation') }}
        </label>
        <PlaceInput id="stageFormStartLocation" v-model="formStage.startLocation" :disabled="disabled" :required="true">
        </PlaceInput>
      </div>
      <div class="col">
        <label for="stageFormEndLocation" class="form-label">
          {{ $t('labels.endLocation') }}
        </label>
        <PlaceInput id="stageFormEndLocation" v-model="formStage.endLocation" :disabled="disabled" :required="true">
        </PlaceInput>
      </div>
    </div>

    <label for="stageFormTransport" class="form-label">
      {{ $t('labels.transport') }}
    </label>
    <select class="form-select mb-3" v-model="formStage.transport" id="stageFormTransport" :disabled="disabled" required>
      <option v-for="transport of ['ownCar', 'airplane', 'shipOrFerry', 'otherTransport']" :value="transport"
        :key="transport">{{ $t('labels.' + transport) }}</option>
    </select>

    <template v-if="formStage.midnightCountries.length > 0">
      <label for="stageFormMidnightCountries" class="form-label me-2">
        {{ $t('labels.midnightCountries') }}
      </label>
      <InfoPoint :text="$t('info.midnightCountries')" />
      <div class="row mb-3" id="stageFormMidnightCountries">
        <div v-for="midnightCountry of formStage.midnightCountries" class="col-auto" :key="midnightCountry.date">
          <label for="stageFormLocation" class="form-label">
            {{ datetoDateString(midnightCountry.date) }}
            {{ $t('labels.midnight') }}
          </label>
          <CountrySelector id="stageFormEndLocation" v-model="midnightCountry.country" :disabled="disabled"
            :required="true">
          </CountrySelector>
        </div>
      </div>
    </template>


    <template v-if="formStage.transport == 'ownCar'">
      <div class="mb-3">
        <label for="stageFormDistance" class="form-label">
          {{ $t('labels.distance') }}
        </label>
        <input type="number" class="form-control" v-model="formStage.distance" id="stageFormDistance" :disabled="disabled"
          required />
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
            <input type="number" class="form-control" v-model="formStage.cost.amount" min="0" :disabled="disabled" />
            <CurrencySelector v-model="formStage.cost.currency" :disabled="disabled" :required="true"></CurrencySelector>
          </div>
        </div>
        <div class="col">
          <label for="endDateInput" class="form-label">{{ $t('labels.invoiceDate') }}</label>
          <input id="endDateInput" class="form-control" type="date" v-model="formStage.cost.date" :required="Boolean(formStage.cost.amount)" :disabled="disabled" :max="$root.dateToHTMLInputString(new Date())" />
        </div>
      </div>

      <div class="mb-3">
        <label for="stageFormFile" class="form-label me-2">{{ $t('labels.receipts') }}</label>
        <InfoPoint :text="$t('info.receipts')" />
        <FileUpload id="stageFormFile" v-model="formStage.cost.receipts" :disabled="disabled"
          :required="Boolean(formStage.cost.amount)" @deleteFile="(id) => $emit('deleteReceipt', id, stage._id, 'stage')"
          @showFile="(id, winProxy) => $emit('showReceipt', id, winProxy, stage._id, 'stage')" />
      </div>
    </template>

    <label for="stageFormPurpose" class="form-label me-2">
      {{ $t('labels.purpose') }}
    </label>
    <InfoPoint :text="$t('info.purpose')" />
    <select class="form-select mb-3" v-model="formStage.purpose" id="stageFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed', 'private']" :value="purpose" :key="purpose">{{ $t('labels.' +
        purpose) }}</option>
    </select>


    <div class="mb-1">
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'add' && !disabled">
        {{ $t('labels.addX', { X: $t('labels.stage') }) }}
      </button>
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'edit' && !disabled">
        {{ $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-danger me-2" v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : $emit('deleted', formStage._id)">
        {{ $t('labels.delete') }}
      </button>
      <button type="button" class="btn btn-light" @click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script>
import CurrencySelector from '../Elements/CurrencySelector.vue'
import CountrySelector from '../Elements/CountrySelector.vue'
import InfoPoint from '../Elements/InfoPoint.vue'
import FileUpload from '../Elements/FileUpload.vue'
import PlaceInput from '../Elements/PlaceInput.vue'
import { getDayList, datetoDateString } from '../../common/scripts.js'
const defaultStage = {
  departure: '',
  arrival: '',
  startLocation: undefined,
  endLocation: undefined,
  midnightCountries: [],
  distance: null,
  transport: 'otherTransport',
  cost: {
    amount: null,
    currency: 'EUR',
    receipts: [],
    date: ''
  },
  purpose: 'professional',
}
export default {
  name: 'StageForm',
  components: { InfoPoint, CurrencySelector, FileUpload, PlaceInput, CountrySelector },
  emits: ['cancel', 'edit', 'add', 'deleted', 'deleteReceipt', 'showReceipt'],
  props: {
    stage: {
      type: Object,
      default: function () {
        return structuredClone(defaultStage)
      },
    },
    mode: {
      type: String,
      required: true,
      validator: function (value) {
        return ['add', 'edit'].indexOf(value) !== -1
      },
    },
    disabled: { type: Boolean, default: false },
    travelStartDate: { type: [String, Date] },
    travelEndDate: { type: [String, Date] },
  },
  data() {
    return {
      formStage: undefined,
      minDate: null,
      maxDate: null
    }
  },
  methods: {
    showMidnightCountries() {
      return ['ownCar', 'otherTransport'].indexOf(this.formStage.transport) !== -1 &&
        this.formStage.startLocation && this.formStage.endLocation &&
        this.formStage.startLocation.country && this.formStage.endLocation.country &&
        this.formStage.startLocation.country._id != this.formStage.endLocation.country._id &&
        this.$root.dateToHTMLInputString(this.formStage.departure) !== this.$root.dateToHTMLInputString(this.formStage.arrival)
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
            if (new Date(oldMC.date) - newMC.date == 0) {
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
      this.formStage = structuredClone(defaultStage)
    },
    output() {
      const output = structuredClone(this.formStage)

      if (!this.showMidnightCountries()) {
        delete output.midnightCountries
      }
      output.departure = this.$root.htmlInputStringToDateTime(output.departure)
      output.arrival = this.$root.htmlInputStringToDateTime(output.arrival)
      if(output.cost.date){
        output.cost.date = new Date(output.cost.date)
      }
      return output
    },
    input() {
      //toleranceStageDatesToApprovedTravelDates
      this.minDate = this.$root.dateTimeToHTMLInputString(new Date(this.travelStartDate).valueOf() - 3 * 24 * 60 * 60 * 1000)
      this.maxDate = this.$root.dateTimeToHTMLInputString(new Date(this.travelEndDate).valueOf() + (3 + 1) * 24 * 60 * 60 * 1000 - 1)
      const input = Object.assign({}, structuredClone(defaultStage), this.stage)
      input.departure = this.$root.dateTimeToHTMLInputString(input.departure)
      input.arrival = this.$root.dateTimeToHTMLInputString(input.arrival)
      input.cost.date = this.$root.dateToHTMLInputString(input.cost.date)
      return input
    },
    datetoDateString
  },
  beforeMount() {
    this.formStage = this.input()
  },
  watch: {
    stage: function () {
      this.formStage = this.input()
    },
    'formStage.transport': function () { this.calcMidnightCountries() },
    'formStage.startLocation.country': function () { this.calcMidnightCountries() },
    'formStage.endLocation.country': function () { this.calcMidnightCountries() },
    'formStage.departure': function () { this.calcMidnightCountries() },
    'formStage.arrival': function () { this.calcMidnightCountries() },
  },
}
</script>

<style></style>