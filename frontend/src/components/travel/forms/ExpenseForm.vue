<template>
  <form @submit.prevent="disabled ? null : emit(mode as 'add', output())">
    <div class="mb-3">
      <label for="expenseFormFile" class="form-label me-2">
        {{ t('labels.receipts') }}
        <span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.receipts')" />
      <FileUpload
        ref="fileUpload"
        id="expenseFormFile"
        v-model="formExpense.cost.receipts"
        :disabled="disabled"
        :endpointPrefix="endpointPrefix"
        :ownerId="ownerId"
        :showUploadFromPhone="props.showUploadFromPhone" />
    </div>

    <div class="mb-2">
      <label for="travelFormDescription" class="form-label">
        {{ t('labels.description') }}
        <span class="text-danger">*</span>
      </label>
      <input type="text" class="form-control" id="travelFormDescription" v-model="formExpense.description" :disabled="disabled" required >
    </div>

    <div class="row mb-2">
      <div class="col">
        <label for="expenseFormCurrency" class="form-label me-2">
          {{ t('labels.currency') }}
          <span class="text-danger">*</span>
        </label>
        <CurrencySelector id="expenseFormCurrency" v-model="formExpense.cost.currency" :disabled="disabled" :required="true" />
        <small v-if="formExpense.cost.positions.length > 1" class="text-secondary tnum">
          {{ t('labels.total') }}: {{ formatter.currency(getCostGrossAmount(formExpense.cost), formExpense.cost.currency._id) }}
        </small>
      </div>
      <div class="col">
        <label for="invoiceDateInput" class="form-label">
          {{ t('labels.invoiceDate') }}
          <span class="text-danger">*</span>
        </label>
        <DateInput
          id="invoiceDateInput"
          :model-value="formExpense.cost.date || undefined"
          @update:model-value="(date) => (formExpense.cost.date = date)"
          :required="true"
          :disabled="disabled"
          :max="new Date()" />
      </div>
    </div>

    <CostPositionsEditor
      v-model="formExpense.cost.positions"
      :default-project="defaultProject"
      report-type="Travel"
      :currency="formExpense.cost.currency"
      :disabled="disabled"
      :require-single-position-description="false" />

    <label for="expenseFormPurpose" class="form-label me-2">
      {{ t('labels.purpose') }}
      <span class="text-danger">*</span>
    </label>
    <InfoPoint :text="t('info.purpose')" />
    <select class="form-select mb-3" v-model="formExpense.purpose" id="expenseFormPurpose" :disabled="disabled" required>
      <option v-for="purpose of ['professional', 'mixed']" :value="purpose" :key="purpose">{{ t('labels.' + purpose) }}</option>
    </select>

    <div class="mb-3">
      <label for="travelFormDescription" class="form-label">{{ t('labels.note') }}</label>
      <CTextArea class="form-control-sm" id="travelFormDescription" v-model="formExpense.note" :disabled="disabled" />
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">
        {{ mode === 'add' ? t('labels.addX', { X: t('labels.expense') }) : t('labels.save') }}
      </button>
      <button
        type="button"
        class="btn btn-danger me-2"
        :disabled="loading"
        v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : emit('deleted', formExpense._id)">
        {{ t('labels.delete') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" @click="emit('cancel')">{{ t('labels.cancel') }}</button>
      <div class="ms-auto">
        <button
          type="button"
          :class="'btn btn-light' + (showPrevButton ? '' : ' invisible')"
          :title="t('labels.previous')"
          @click="emit('prev')">
          <i class="bi bi-chevron-left"></i>
        </button>
        <button
          type="button"
          :class="'btn btn-light ms-2' + (showNextButton ? '' : ' invisible')"
          :title="t('labels.next')"
          @click="emit('next')">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { baseCurrency, ProjectSimple, TravelExpense } from 'abrechnung-common/types.js'
import { getCostGrossAmount } from 'abrechnung-common/utils/scripts.js'
import { PropType, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CurrencySelector from '../../elements/CurrencySelector.vue'
import CostPositionsEditor from '../../elements/CostPositionsEditor.vue'
import DateInput from '../../elements/DateInput.vue'
import FileUpload from '../../elements/FileUpload.vue'
import InfoPoint from '../../elements/InfoPoint.vue'
import { formatter } from '@/formatter.js'
import CTextArea from '../../elements/TextArea.vue'

const { t } = useI18n()

const emit = defineEmits<{
  cancel: []
  edit: [Partial<TravelExpense<string>>]
  add: [Partial<TravelExpense<string>>]
  deleted: [string | undefined]
  next: []
  prev: []
}>()
const props = defineProps({
  expense: { type: Object as PropType<Partial<TravelExpense<string>>> },
  mode: { type: String as PropType<'add' | 'edit'>, required: true },
  disabled: { type: Boolean, default: false },
  endpointPrefix: { type: String, default: '' },
  ownerId: { type: String },
  showProjectSelection: { type: Boolean, default: true },
  showUploadFromPhone: { type: Boolean, default: true },
  showPrevButton: { type: Boolean, default: false },
  showNextButton: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  defaultProject: { type: Object as PropType<ProjectSimple<string>>, required: true }
})

const formExpense = ref(input())
const fileUploadRef = useTemplateRef('fileUpload')

function defaultExpense() {
  return {
    description: '',
    cost: { positions: [], currency: baseCurrency, receipts: [], date: '' },
    purpose: 'professional' as TravelExpense['purpose'],
    note: undefined,
  }
}
function clear() {
  fileUploadRef.value?.clear()
  formExpense.value = defaultExpense()
}

function input() {
  return { ...defaultExpense(), ...props.expense }
}
function output() {
  return formExpense.value
}

watch(
  () => props.expense,
  () => {
    clear()
    formExpense.value = input()
  }
)
</script>

<style></style>
