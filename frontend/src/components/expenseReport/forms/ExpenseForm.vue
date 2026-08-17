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
        :required="false"
        :endpointPrefix="endpointPrefix"
        :ownerId="ownerId"
        :report-id="reportId"
        source-report-type="ExpenseReport"
        :suggestion-failed="suggestionFailed"
        :suggestion-processing="suggestingFromReceipts"
        receipt-processing
        @processing="(processing: boolean) => (uploadingReceipts = processing)"
        @receipts-changing="cancelReceiptSuggestion"
        @receipts-ready="suggestFromReceipts" />
    </div>

    <div class="mb-2">
      <label for="travelFormDescription" class="form-label">
        {{ t('labels.description') }}
        <span class="text-danger">*</span>
      </label>
      <input type="text" class="form-control" id="travelFormDescription" v-model="formExpense.description" :disabled="disabled" required @input="dirtyFields.add('description')" >
    </div>

    <div class="row mb-2">
      <div class="col">
        <label for="expenseFormCurrency" class="form-label me-2">
          {{ t('labels.currency') }}
          <span class="text-danger">*</span>
        </label>
        <CurrencySelector id="expenseFormCurrency" v-model="formExpense.cost.currency" :disabled="disabled" :required="true" @update:model-value="dirtyFields.add('currency')" />
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
          @update:model-value="(date) => { formExpense.cost.date = date; dirtyFields.add('date') }"
          :required="true"
          :disabled="disabled"
          :max="new Date()" />
      </div>
    </div>

    <CostPositionsEditor
      v-model="formExpense.cost.positions"
      :default-project="defaultProject"
      report-type="ExpenseReport"
      :currency="formExpense.cost.currency"
      :disabled="disabled"
      @user-change="dirtyFields.add('positions')"
      :require-single-position-description="false" />

    <div class="mb-3">
      <label for="travelFormDescription" class="form-label">{{ t('labels.note') }}</label>
      <CTextArea class="form-control-sm" id="travelFormDescription" v-model="formExpense.note" :disabled="disabled" />
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading || uploadingReceipts">
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
import { baseCurrency, Expense, ProjectSimple } from 'abrechnung-common/types.js'
import { getCostGrossAmount } from 'abrechnung-common/utils/scripts.js'
import { PropType, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CurrencySelector from '@/components/elements/CurrencySelector.vue'
import CostPositionsEditor from '@/components/elements/CostPositionsEditor.vue'
import DateInput from '@/components/elements/DateInput.vue'
import FileUpload from '@/components/elements/FileUpload.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import { formatter } from '@/formatter.js'
import CTextArea from '@/components/elements/TextArea.vue'
import APP_LOADER from '@/dataLoader.js'
import { applySuggestedCost, receiptIds, requestReceiptSuggestion } from '@/receiptSuggestions.js'

const { t } = useI18n()
const APP_DATA = APP_LOADER.data

const emit = defineEmits<{
  cancel: []
  edit: [Partial<Expense<string>>]
  add: [Partial<Expense<string>>]
  deleted: [string | undefined]
  next: []
  prev: []
}>()
const props = defineProps({
  expense: { type: Object as PropType<Partial<Expense<string>>> },
  mode: { type: String as PropType<'add' | 'edit'>, required: true },
  disabled: { type: Boolean, default: false },
  endpointPrefix: { type: String, default: '' },
  ownerId: { type: String },
  reportId: { type: String },
  showPrevButton: { type: Boolean, default: false },
  showNextButton: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  defaultProject: { type: Object as PropType<ProjectSimple<string>>, required: true }
})

const dirtyFields = new Set<string>()
const uploadingReceipts = ref(false)
const suggestingFromReceipts = ref(false)
const suggestionFailed = ref(false)
let suggestionGeneration = 0
const formExpense = ref(input())
const fileUploadRef = useTemplateRef('fileUpload')

protectExistingValues()

function defaultExpense() {
  return { description: '', cost: { positions: [], currency: baseCurrency, receipts: [], date: '' }, note: undefined }
}
function clear() {
  fileUploadRef.value?.clear()
  cancelReceiptSuggestion()
  dirtyFields.clear()
  formExpense.value = defaultExpense()
}
function cancelReceiptSuggestion() {
  suggestionGeneration += 1
  suggestingFromReceipts.value = false
  suggestionFailed.value = false
}

function input() {
  return { ...defaultExpense(), ...props.expense }
}
function output() {
  return formExpense.value
}

function protectExistingValues() {
  dirtyFields.clear()
  if (!props.expense?._id) return
  if (props.expense.description) dirtyFields.add('description')
  if (props.expense.cost?.currency) dirtyFields.add('currency')
  if (props.expense.cost?.date) dirtyFields.add('date')
  if (props.expense.cost?.positions?.length) dirtyFields.add('positions')
}

async function suggestFromReceipts() {
  const generation = ++suggestionGeneration
  suggestingFromReceipts.value = true
  suggestionFailed.value = false
  try {
    const position = formExpense.value.cost.positions[0]
    const suggestion = await requestReceiptSuggestion({
      type: 'expense',
      reportType: 'ExpenseReport',
      projectId: position?.project?._id ?? props.defaultProject._id,
      documentFileIds: receiptIds(formExpense.value.cost.receipts),
      reportId: props.reportId,
      sourceReportType: 'ExpenseReport',
      endpointPrefix: props.endpointPrefix
    })
    if (generation !== suggestionGeneration || suggestion?.type !== 'expense') return
    if (!dirtyFields.has('description') && !formExpense.value.description && suggestion.description) {
      formExpense.value.description = suggestion.description
    }
    if (APP_DATA.value) {
      applySuggestedCost(formExpense.value.cost, suggestion.cost, {
        categories: APP_DATA.value.categories,
        currencies: APP_DATA.value.currencies,
        defaultProject: props.defaultProject,
        dirty: dirtyFields,
        reportType: 'ExpenseReport'
      })
    }
  } catch {
    if (generation === suggestionGeneration) suggestionFailed.value = true
  } finally {
    if (generation === suggestionGeneration) suggestingFromReceipts.value = false
  }
}

watch(
  () => props.expense,
  () => {
    clear()
    formExpense.value = input()
    protectExistingValues()
  }
)
</script>

<style></style>
