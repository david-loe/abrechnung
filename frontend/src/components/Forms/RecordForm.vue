<template>
  <form @submit.prevent="mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <ul class="nav nav-pills nav-justified mb-3">
      <li class="nav-item">
        <a href="#" :class="'nav-link' + (formRecord.type == 'route' ? ' active' : '')"
          @click="formRecord.type = 'route'">
          {{ $t('labels.route') }} <i class="bi bi-bus-front-fill"></i>
        </a>
      </li>
      <li class="nav-item">
        <a href="#" :class="'nav-link' + (formRecord.type == 'stay' ? ' active' : '')" @click="formRecord.type = 'stay'">
          {{ $t('labels.stay') }} <i class="bi bi-house-fill"></i>
        </a>
      </li>
    </ul>

    <div class="row mb-3">
      <div class="col">
        <label for="startDateInput" class="form-label">{{ $t('labels.from') }}</label>
        <input id="startDateInput" class="form-control" type="datetime-local" v-model="formRecord.startDate" required />
      </div>
      <div class="col">
        <label for="endDateInput" class="form-label">{{ $t('labels.to') }}</label>
        <input id="endDateInput" class="form-control" type="datetime-local" v-model="formRecord.endDate"
          :min="formRecord.startDate" required />
      </div>
    </div>

    <template v-if="formRecord.type == 'route'">
      <div class="row mb-3">
        <div class="col">
          <label for="recordFormStartLocation" class="form-label">
            {{ $t('labels.startLocation') }}
          </label>
          <PlaceInput id="recordFormStartLocation" v-model="formRecord.startLocation" :required="true"></PlaceInput>
        </div>
        <div class="col">
          <label for="recordFormEndLocation" class="form-label">
            {{ $t('labels.endLocation') }}
          </label>
          <PlaceInput id="recordFormEndLocation" v-model="formRecord.endLocation" :required="true"></PlaceInput>
        </div>
      </div>

      <label for="recordFormTransport" class="form-label">
        {{ $t('labels.transport') }}
      </label>
      <select class="form-select mb-3" v-model="formRecord.transport" id="recordFormTransport" required>
        <option v-for="transport of ['ownCar', 'airplane', 'shipOrFerry', 'otherTransport']" :value="transport" :key="transport">{{ $t('labels.' + transport) }}</option>
      </select>
    </template>

    <template v-else>
      <div class="mb-3">
        <label for="recordFormLocation" class="form-label">
          {{ $t('labels.location') }}
        </label>
        <PlaceInput id="recordFormLocation" v-model="formRecord.location" :required="true"></PlaceInput>
      </div>
    </template>

    <template v-if="(formRecord.type == 'route' && formRecord.transport == 'ownCar')">
      <div class="mb-3">
        <label for="recordFormDistance" class="form-label">
          {{ $t('labels.distance') }}
        </label>
        <input type="number" class="form-control" v-model="formRecord.distance" id="recordFormDistance" required />
      </div>
    </template>

    <template
      v-if="(formRecord.type == 'route' && formRecord.transport != 'ownCar') || (formRecord.type == 'stay' && askStayCost)">
      <label for="recordFormCost" class="form-label me-2">
        {{ $t('labels.cost') }}
      </label>
      <InfoPoint :text="$t('info.cost')" />
      <div class="input-group mb-2" id="recordFormCost">
        <input type="number" class="form-control" v-model="formRecord.cost.amount" min="0" />
        <CurrencySelector v-model="formRecord.cost.currency" :required="true"></CurrencySelector>
      </div>
      <div class="mb-3">
        <label for="recordFormFile" class="form-label me-2">{{ $t('labels.receipts') }}</label>
        <InfoPoint :text="$t('info.receipts')" />
        <FileUpload id="recordFormFile" v-model="formRecord.cost.receipts" :required="formRecord.cost.amount"
          @deleteFile="(id) => $emit('deleteReceipt', id, record._id)"
          @showFile="(id) => $emit('showReceipt', id, record._id)" />
      </div>
    </template>

    <template v-if="askPurpose">
      <label for="recordFormPurpose" class="form-label me-2">
        {{ $t('labels.purpose') }}
      </label>
      <InfoPoint :text="$t('info.purpose')" />
      <select class="form-select mb-3" v-model="formRecord.purpose" id="recordFormPurpose" required>
        <option v-for="purpose of ['professional', 'mixed', 'private']" :value="purpose" :key="purpose">{{ $t('labels.' + purpose) }}</option>
      </select>
    </template>

    <div class="mb-1">
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'add'">
        {{ $t('labels.addX', { X: $t('labels.record') }) }}
      </button>
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'edit'">
        {{ $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-danger me-2" v-if="mode === 'edit'" @click="$emit('deleted', formRecord._id)">
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
import InfoPoint from '../Elements/InfoPoint.vue'
import FileUpload from '../Elements/FileUpload.vue'
import PlaceInput from '../Elements/PlaceInput.vue'
const defaultRecord = {
  type: 'route',
  startDate: '',
  endDate: '',
  startLocation: undefined,
  endLocation: undefined,
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
  components: { InfoPoint, CurrencySelector, FileUpload, PlaceInput },
  emits: ['cancel', 'edit', 'add', 'deleted', 'deleteReceipt', 'showReceipt'],
  props: {
    record: {
      type: Object,
      default: function () {
        return defaultRecord
      },
    },
    mode: {
      type: String,
      required: true,
      validator: function (value) {
        return ['add', 'edit'].indexOf(value) !== -1
      },
    },
    askPurpose: { type: Boolean, default: true },
    askStayCost: { type: Boolean, default: true },
  },
  data() {
    return {
      formRecord: undefined,
    }
  },
  methods: {
    clear() {
      this.formRecord = defaultRecord
    },
    output() {
      const output = Object.assign({}, this.formRecord)
      if(output.type == 'route'){
        delete output.location
      }else{
        delete output.startLocation
        delete output.endLocation
        delete output.distance
        delete output.transport
      }
      output.startDate = this.$root.htmlInputStringToDateTime(output.startDate)
      output.endDate = this.$root.htmlInputStringToDateTime(output.endDate)
      return output
    },
    input() {
      const input = Object.assign({}, defaultRecord, this.record)
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
  },
}
</script>

<style></style>