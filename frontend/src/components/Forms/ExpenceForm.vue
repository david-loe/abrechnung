<template>
  <form @submit.prevent="disabled ? null : (mode === 'add' ? $emit('add', output()) : $emit('edit', output()))">

    <div class="mb-2">
      <label for="travelFormDescription" class="form-label">
        {{ $t('labels.description') }}
      </label>
      <input type="text" class="form-control" id="travelFormDescription" v-model="formExpence.description" :disabled="disabled"/>
    </div>

    <div class="row mb-2">
      <div class="col">
        <label for="expenceFormCost" class="form-label me-2">
          {{ $t('labels.cost') }}
        </label>
        <InfoPoint :text="$t('info.cost')" />
        <div class="input-group" id="expenceFormCost">
          <input type="number" class="form-control" v-model="formExpence.cost.amount" min="0" :disabled="disabled" />
          <CurrencySelector v-model="formExpence.cost.currency" :disabled="disabled" :required="true"></CurrencySelector>
        </div>
      </div>
      <div class="col">
        <label for="endDateInput" class="form-label">{{ $t('labels.invoiceDate') }}</label>
        <input id="endDateInput" class="form-control" type="date" v-model="formExpence.cost.date"
          :required="Boolean(formExpence.cost.amount)" :disabled="disabled" :max="$root.dateToHTMLInputString(new Date())" />
      </div>
    </div>

    <div class="mb-3">
      <label for="expenceFormFile" class="form-label me-2">{{ $t('labels.receipts') }}</label>
      <InfoPoint :text="$t('info.receipts')" />
      <FileUpload id="expenceFormFile" v-model="formExpence.cost.receipts" :disabled="disabled"
        :required="Boolean(formExpence.cost.amount)" @deleteFile="(id) => $emit('deleteReceipt', id, expence._id, 'expence')"
        @showFile="(id) => $emit('showReceipt', id, expence._id, 'expence')" />
    </div>


    <label for="expenceFormPurpose" class="form-label me-2">
      {{ $t('labels.purpose') }}
    </label>
    <InfoPoint :text="$t('info.purpose')" />
    <select class="form-select mb-3" v-model="formExpence.purpose" id="expenceFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed']" :value="purpose" :key="purpose">{{ $t('labels.' +
        purpose) }}</option>
    </select>


    <div class="mb-1">
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'add' && !disabled">
        {{ $t('labels.addX', { X: $t('labels.expence') }) }}
      </button>
      <button type="submit" class="btn btn-primary me-2" v-if="mode === 'edit' && !disabled">
        {{ $t('labels.save') }}
      </button>
      <button type="button" class="btn btn-danger me-2" v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : $emit('deleted', formExpence._id)">
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
const defaultExpence = {
  cost: {
    amount: null,
    currency: 'EUR',
    receipts: [],
    date: ''
  },
  purpose: 'professional',
}
export default {
  name: 'ExpenceForm',
  components: { InfoPoint, CurrencySelector, FileUpload },
  emits: ['cancel', 'edit', 'add', 'deleted', 'deleteReceipt', 'showReceipt'],
  props: {
    expence: {
      type: Object,
      default: function () {
        return structuredClone(defaultExpence)
      },
    },
    mode: {
      type: String,
      required: true,
      validator: function (value) {
        return ['add', 'edit'].indexOf(value) !== -1
      },
    },
    disabled: { type: Boolean, default: false }
  },
  data() {
    return {
      formExpence: undefined
    }
  },
  methods: {
    clear() {
      this.formExpence = structuredClone(defaultExpence)
    },
    output() {
      const output = structuredClone(this.formExpence)
      output.cost.date = new Date(output.cost.date)
      return output
    },
    input() {
      const input = Object.assign({}, structuredClone(defaultExpence), this.expence)
      input.cost.date = this.$root.dateToHTMLInputString(input.cost.date)
      return input
    },
  },
  beforeMount() {
    this.formExpence = this.input()
  },
  watch: {
    expence: function () {
      this.formExpence = this.input()
    },
  },
}
</script>

<style></style>