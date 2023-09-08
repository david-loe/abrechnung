<template>
  <form @submit.prevent="disabled ? null : mode === 'add' ? $emit('add', output()) : $emit('edit', output())">
    <div class="mb-2">
      <label for="travelFormDescription" class="form-label"> {{ $t('labels.description') }}<span class="text-danger">*</span> </label>
      <input type="text" class="form-control" id="travelFormDescription" v-model="formExpense.description" :disabled="disabled" required />
    </div>

    <div class="row mb-2">
      <div class="col">
        <label for="expenseFormCost" class="form-label me-2"> {{ $t('labels.cost') }}<span class="text-danger">*</span> </label>
        <InfoPoint :text="$t('info.cost')" />
        <div class="input-group" id="expenseFormCost">
          <input type="number" class="form-control" step="0.01" v-model="formExpense.cost.amount" min="0" :disabled="disabled" />
          <CurrencySelector v-model="formExpense.cost.currency" :disabled="disabled" :required="true"></CurrencySelector>
        </div>
      </div>
      <div class="col">
        <label for="invoiceDateInput" class="form-label">{{ $t('labels.invoiceDate') }}<span class="text-danger">*</span></label>
        <DateInput id="invoiceDateInput" v-model="formExpense.cost.date" :required="true" :disabled="disabled" :max="new Date()" />
      </div>
    </div>

    <div class="mb-3">
      <label for="expenseFormFile" class="form-label me-2">{{ $t('labels.receipts') }}<span class="text-danger">*</span></label>
      <InfoPoint :text="$t('info.receipts')" />
      <FileUpload
        ref="fileUpload"
        id="expenseFormFile"
        v-model="formExpense.cost.receipts"
        :disabled="disabled"
        :required="true"
        :endpointPrefix="endpointPrefix" />
    </div>

    <label for="expenseFormPurpose" class="form-label me-2"> {{ $t('labels.purpose') }}<span class="text-danger">*</span> </label>
    <InfoPoint :text="$t('info.purpose')" />
    <select class="form-select mb-3" v-model="formExpense.purpose" id="expenseFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed']" :value="purpose" :key="purpose">{{ $t('labels.' + purpose) }}</option>
    </select>

    <div class="mb-1">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">
        <span v-if="loading" class="spinner-border spinner-border-sm"></span>
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.expense') }) : $t('labels.save') }}
      </button>
      <button
        type="button"
        class="btn btn-danger me-2"
        v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : $emit('deleted', formExpense._id)">
        {{ $t('labels.delete') }}
      </button>
      <button type="button" class="btn btn-light" @click="$emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import { defineComponent, PropType, toRaw } from 'vue'
import CurrencySelector from '../Elements/CurrencySelector.vue'
import InfoPoint from '../Elements/InfoPoint.vue'
import FileUpload from '../Elements/FileUpload.vue'
import DateInput from '../Elements/DateInput.vue'
import { Expense } from '../../../../common/types.js'
import settings from '../../../../common/settings.json'

interface FormExpense extends Omit<Expense, '_id'> {
  _id?: string
}

const defaultExpense: FormExpense = {
  description: '',
  cost: {
    amount: null,
    currency: settings.baseCurrency,
    receipts: [],
    date: ''
  },
  purpose: 'professional'
}
export default defineComponent({
  name: 'expenseForm',
  components: { InfoPoint, CurrencySelector, FileUpload, DateInput },
  emits: ['cancel', 'edit', 'add', 'deleted'],
  props: {
    expense: {
      type: Object as PropType<Partial<Expense>>,
      default: () => structuredClone(defaultExpense)
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    },
    disabled: { type: Boolean, default: false },
    endpointPrefix: { type: String, default: '' }
  },
  data() {
    return {
      formExpense: structuredClone(defaultExpense),
      loading: false
    }
  },
  methods: {
    clear() {
      if (this.$refs.fileUpload) {
        ;(this.$refs.fileUpload as typeof FileUpload).clear()
      }
      this.loading = false
      this.formExpense = structuredClone(defaultExpense)
    },
    output() {
      this.loading = true
      return this.formExpense
    },
    input() {
      this.loading = false
      return Object.assign({}, structuredClone(defaultExpense), this.expense)
    }
  },
  beforeMount() {
    this.formExpense = this.input()
  },
  watch: {
    expense: function () {
      this.clear()
      this.formExpense = this.input()
    }
  }
})
</script>

<style></style>
