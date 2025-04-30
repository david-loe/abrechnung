<template>
  <form @submit.prevent="disabled ? null : $emit(mode, output())">
    <div class="mb-2">
      <label for="travelFormDescription" class="form-label"> {{ $t('labels.description') }}<span class="text-danger">*</span> </label>
      <input type="text" class="form-control" id="travelFormDescription" v-model="formExpense.description" :disabled="disabled" required />
    </div>

    <div class="row mb-2">
      <div class="col">
        <label for="expenseFormCost" class="form-label me-2"> {{ $t('labels.cost') }}<span class="text-danger">*</span> </label>
        <InfoPoint :text="$t('info.cost')" />
        <div class="input-group" id="expenseFormCost">
          <input type="number" class="form-control" step="0.01" v-model="formExpense.cost.amount" min="0" :disabled="disabled" required />
          <CurrencySelector v-model="formExpense.cost.currency" :disabled="disabled" :required="true"></CurrencySelector>
        </div>
      </div>
      <div class="col">
        <label for="invoiceDateInput" class="form-label">{{ $t('labels.invoiceDate') }}<span class="text-danger">*</span></label>
        <DateInput id="invoiceDateInput" v-model="formExpense.cost.date" :required="true" :disabled="disabled" :max="new Date()" />
      </div>
    </div>

    <div class="mb-2">
      <label for="expenseFormFile" class="form-label me-2">{{ $t('labels.receipts') }}<span class="text-danger">*</span></label>
      <InfoPoint :text="$t('info.receipts')" />
      <FileUpload
        ref="fileUpload"
        id="expenseFormFile"
        v-model="formExpense.cost.receipts"
        :disabled="disabled"
        :required="true"
        :endpointPrefix="endpointPrefix"
        :ownerId="ownerId" />
    </div>

    <div class="mb-3">
      <label for="travelFormDescription" class="form-label"> {{ $t('labels.note') }}</label>
      <TextArea class="form-control-sm" id="travelFormDescription" v-model="formExpense.note" :disabled="disabled"></TextArea>
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">
        {{ mode === 'add' ? $t('labels.addX', { X: $t('labels.expense') }) : $t('labels.save') }}
      </button>
      <button
        type="button"
        class="btn btn-danger me-2"
        :disabled="loading"
        v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : $emit('deleted', formExpense._id)">
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
import { Expense, baseCurrency } from '@/../../common/types.js'
import CurrencySelector from '@/components/elements/CurrencySelector.vue'
import DateInput from '@/components/elements/DateInput.vue'
import FileUpload from '@/components/elements/FileUpload.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import TextArea from '@/components/elements/TextArea.vue'

import { PropType, defineComponent } from 'vue'

export default defineComponent({
  name: 'ExpenseForm',
  components: { InfoPoint, CurrencySelector, FileUpload, DateInput, TextArea },
  emits: ['cancel', 'edit', 'add', 'deleted', 'next', 'prev'],
  props: {
    expense: {
      type: Object as PropType<Partial<Expense>>
    },
    mode: {
      type: String as PropType<'add' | 'edit'>,
      required: true
    },
    disabled: { type: Boolean, default: false },
    endpointPrefix: { type: String, default: '' },
    ownerId: { type: String },
    showPrevButton: { type: Boolean, default: false },
    showNextButton: { type: Boolean, default: false },
    loading: { type: Boolean, default: false }
  },
  data() {
    return {
      formExpense: this.default()
    }
  },
  methods: {
    default() {
      return {
        description: '',
        cost: {
          amount: null,
          currency: baseCurrency,
          receipts: [],
          date: ''
        },
        note: undefined
      }
    },
    clear() {
      if (this.$refs.fileUpload) {
        ;(this.$refs.fileUpload as typeof FileUpload).clear()
      }
      this.formExpense = this.default()
    },
    output() {
      return this.formExpense
    },
    input() {
      return Object.assign({}, this.default(), this.expense)
    }
  },
  created() {
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
