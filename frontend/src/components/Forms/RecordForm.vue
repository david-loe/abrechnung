<template>
  <form @submit.prevent="disabled ? null : (mode === 'add' ? $emit('add', output()) : $emit('edit', output()))">
    <ul class="nav nav-pills nav-justified mb-3">
      <li class="nav-item">
        <a href="#" :class="'nav-link' + (formRecord.type == 'route' ? ' active' : (disabled ? ' disabled' : ''))"
          @click="disabled ? null : formRecord.type = 'route'">
          {{ $t('labels.route') }} <i class="bi bi-bus-front-fill"></i>
        </a>
      </li>
      <li class="nav-item">
        <a href="#" :class="'nav-link' + (formRecord.type == 'stay' ? ' active' : (disabled ? ' disabled' : ''))" @click="disabled ? null : formRecord.type = 'stay'">
          {{ $t('labels.stay') }} <i class="bi bi-house-fill"></i>
        </a>
      </li>
    </ul>

    <div class="row mb-3">
      <div class="col">
        <label for="startDateInput" class="form-label">{{ $t(formRecord.type == 'route' ? 'labels.departure' :
          'labels.from') }}</label>
        <input id="startDateInput" class="form-control" type="datetime-local" v-model="formRecord.startDate"
          :min="minDate" :max="maxDate" :disabled="disabled" required />
      </div>
      <div class="col">
        <label for="endDateInput" class="form-label">{{ $t(formRecord.type == 'route' ? 'labels.arrival' : 'labels.to')
        }}</label>
        <input id="endDateInput" class="form-control" type="datetime-local" v-model="formRecord.endDate"
          :min="formRecord.startDate ? formRecord.startDate : minDate" :max="maxDate" :disabled="disabled" required />
      </div>
    </div>

    <template v-if="formRecord.type == 'route'">
      <div class="row mb-3">
        <div class="col">
          <label for="recordFormStartLocation" class="form-label">
            {{ $t('labels.startLocation') }}
          </label>
          <PlaceInput id="recordFormStartLocation" v-model="formRecord.startLocation" :disabled="disabled" :required="true"></PlaceInput>
        </div>
        <div class="col">
          <label for="recordFormEndLocation" class="form-label">
            {{ $t('labels.endLocation') }}
          </label>
          <PlaceInput id="recordFormEndLocation" v-model="formRecord.endLocation" :disabled="disabled" :required="true"></PlaceInput>
        </div>
      </div>

      <label for="recordFormTransport" class="form-label">
        {{ $t('labels.transport') }}
      </label>
      <select class="form-select mb-3" v-model="formRecord.transport" id="recordFormTransport" :disabled="disabled" required>
        <option v-for="transport of ['ownCar', 'airplane', 'shipOrFerry', 'otherTransport']" :value="transport"
          :key="transport">{{ $t('labels.' + transport) }}</option>
      </select>

      <template v-if="formRecord.midnightCountries.length > 0">
        <label for="recordFormMidnightCountries" class="form-label me-2">
          {{ $t('labels.midnightCountries') }}
        </label>
        <InfoPoint :text="$t('info.midnightCountries')" />
        <div class="row mb-3" id="recordFormMidnightCountries">
          <div v-for="midnightCountry of formRecord.midnightCountries" class="col-auto" :key="midnightCountry.date">
            <label for="recordFormLocation" class="form-label">
              {{ $root.datetoDateString(midnightCountry.date) }}
              {{ $t('labels.midnight') }}
            </label>
            <CountrySelector id="recordFormEndLocation" v-model="midnightCountry.country" :disabled="disabled" :required="true">
            </CountrySelector>
          </div>
        </div>
      </template>
    </template>

    <template v-else>
      <div class="mb-3">
        <label for="recordFormLocation" class="form-label">
          {{ $t('labels.location') }}
        </label>
        <PlaceInput id="recordFormLocation" v-model="formRecord.location" :disabled="disabled" :required="true"></PlaceInput>
      </div>
    </template>

    <template v-if="(formRecord.type == 'route' && formRecord.transport == 'ownCar')">
      <div class="mb-3">
        <label for="recordFormDistance" class="form-label">
          {{ $t('labels.distance') }}
        </label>
        <input type="number" class="form-control" v-model="formRecord.distance" id="recordFormDistance" :disabled="disabled" required />
      </div>
    </template>

    <template
      v-if="(formRecord.type == 'route' && formRecord.transport != 'ownCar') || (formRecord.type == 'stay' && askStayCost)">
      <label for="recordFormCost" class="form-label me-2">
        {{ $t('labels.cost') }}
      </label>
      <InfoPoint :text="$t('info.cost')" />
      <div class="input-group mb-2" id="recordFormCost">
        <input type="number" class="form-control" v-model="formRecord.cost.amount" min="0" :disabled="disabled" />
        <CurrencySelector v-model="formRecord.cost.currency" :disabled="disabled" :required="true"></CurrencySelector>
      </div>
      <div class="mb-3">
        <label for="recordFormFile" class="form-label me-2">{{ $t('labels.receipts') }}</label>
        <InfoPoint :text="$t('info.receipts')" />
        <FileUpload id="recordFormFile" v-model="formRecord.cost.receipts" :disabled="disabled" :required="Boolean(formRecord.cost.amount)"
          @deleteFile="(id) => $emit('deleteReceipt', id, record._id)"
          @showFile="(id) => $emit('showReceipt', id, record._id)" />
      </div>
    </template>

    <label for="recordFormPurpose" class="form-label me-2">
      {{ $t('labels.purpose') }}
    </label>
    <InfoPoint :text="$t('info.purpose')" />
    <select class="form-select mb-3" v-model="formRecord.purpose" id="recordFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed', 'private']" :value="purpose" :key="purpose">{{ $t('labels.' +
        purpose) }}</option>
    </select>


    <div class="mb-1">
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'add' && !disabled">
        {{ $t('labels.addX', { X: $t('labels.record') }) }}
      </button>
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'edit' && !disabled">
        {{ $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-danger me-2" v-if="mode === 'edit' && !disabled" @click="disabled ? null : $emit('deleted', formRecord._id)">
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
import { getDayList } from '../../scripts.js'
const defaultRecord = {
  type: 'route',
  startDate: '',
  endDate: '',
  startLocation: undefined,
  endLocation: undefined,
  midnightCountries: [],
  distance: null,
  location: undefined,
  transport: 'otherTransport',
  cost: {
    amount: null,
    currency: 'EUR',
    receipts: [],
  },
  purpose: 'professional',
}
export default {
  name: 'RecordForm',
  components: { InfoPoint, CurrencySelector, FileUpload, PlaceInput, CountrySelector },
  emits: ['cancel', 'edit', 'add', 'deleted', 'deleteReceipt', 'showReceipt'],
  props: {
    record: {
      type: Object,
      default: function () {
        return structuredClone(defaultRecord)
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
    askStayCost: { type: Boolean, default: true },
    travelStartDate: { type: [String, Date] },
    travelEndDate: { type: [String, Date] },
  },
  data() {
    return {
      formRecord: undefined,
      minDate: null,
      maxDate: null
    }
  },
  methods: {
    showMidnightCountries() {
      return this.formRecord.type == 'route' && ['ownCar', 'otherTransport'].indexOf(this.formRecord.transport) !== -1 &&
        this.formRecord.startLocation && this.formRecord.endLocation &&
        this.formRecord.startLocation.country && this.formRecord.endLocation.country &&
        this.formRecord.startLocation.country._id != this.formRecord.endLocation.country._id &&
        this.$root.dateToHTMLInputString(this.formRecord.startDate) !== this.$root.dateToHTMLInputString(this.formRecord.endDate)
    },
    calcMidnightCountries() {
      if (this.showMidnightCountries()) {
        const newMidnightCountries = []
        const days = getDayList(this.formRecord.startDate, this.formRecord.endDate)
        days.splice(-1, 1)
        for (const day of days) {
          newMidnightCountries.push({ date: day })
        }
        for (const oldMC of this.formRecord.midnightCountries) {
          for (const newMC of newMidnightCountries) {
            if (new Date(oldMC.date) - newMC.date == 0) {
              Object.assign(newMC, oldMC)
              break
            }
          }
        }
        this.formRecord.midnightCountries = newMidnightCountries
      } else {
        this.formRecord.midnightCountries = []
      }
    },
    clear() {
      this.formRecord = structuredClone(defaultRecord)
    },
    output() {
      const output = structuredClone(this.formRecord)
      if (output.type == 'route') {
        delete output.location
      } else {
        delete output.startLocation
        delete output.endLocation
        delete output.distance
        delete output.transport
      }
      if (!this.showMidnightCountries()) {
        delete output.midnightCountries
      }
      output.startDate = this.$root.htmlInputStringToDateTime(output.startDate)
      output.endDate = this.$root.htmlInputStringToDateTime(output.endDate)
      return output
    },
    input() {
      //toleranceRecordDatesToApprovedTravelDates
      this.minDate = this.$root.dateTimeToHTMLInputString(new Date(this.travelStartDate).valueOf() - 3 * 24 * 60 * 60 * 1000)
      this.maxDate = this.$root.dateTimeToHTMLInputString(new Date(this.travelEndDate).valueOf() + 4 * 24 * 60 * 60 * 1000 - 1)
      const input = Object.assign({}, structuredClone(defaultRecord), this.record)
      input.startDate = this.$root.dateTimeToHTMLInputString(input.startDate)
      input.endDate = this.$root.dateTimeToHTMLInputString(input.endDate)
      return input
    },
  },
  beforeMount() {
    this.formRecord = this.input()
  },
  watch: {
    record: function () {
      this.formRecord = this.input()
    },
    'formRecord.type': function () { this.calcMidnightCountries() },
    'formRecord.transport': function () { this.calcMidnightCountries() },
    'formRecord.startLocation.country': function () { this.calcMidnightCountries() },
    'formRecord.endLocation.country': function () { this.calcMidnightCountries() },
    'formRecord.startDate': function () { this.calcMidnightCountries() },
    'formRecord.endDate': function () { this.calcMidnightCountries() },
  },
}
</script>

<style></style>