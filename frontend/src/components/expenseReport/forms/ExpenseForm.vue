<template>
  <form @submit.prevent="disabled ? null : emit(mode as 'add', output())">
    <div class="mb-2">
      <label for="travelFormDescription" class="form-label">
        {{ t('labels.description') }}
        <span class="text-danger">*</span>
      </label>
      <input type="text" class="form-control" id="travelFormDescription" v-model="formExpense.description" :disabled="disabled" required >
    </div>

    <div class="row mb-2">
      <div class="col">
        <label for="expenseFormCost" class="form-label me-2">
          {{ t('labels.cost') }}
          <span class="text-danger">*</span>
        </label>
        <InfoPoint :text="t('info.cost')" />
        <div class="input-group" id="expenseFormCost">
          <input type="number" class="form-control" step="0.01" v-model="formExpense.cost.amount" :disabled="disabled" required >
          <CurrencySelector v-model="formExpense.cost.currency" :disabled="disabled" :required="true" />
        </div>
        <div v-if="formExpense.cost.amount && formExpense.cost.amount < 0" class="alert alert-info d-flex px-2 py-1 mt-2" role="alert">
          <small>
            <i class="bi bi-info-circle-fill"></i>
            <span class="ms-2"> {{ t('alerts.amountIsNegative') }}</span>
          </small>
        </div>
      </div>
      <div class="col">
        <label for="invoiceDateInput" class="form-label">
          {{ t('labels.invoiceDate') }}
          <span class="text-danger">*</span>
        </label>
        <DateInput id="invoiceDateInput" v-model="formExpense.cost.date" :required="true" :disabled="disabled" :max="new Date()" />
      </div>
    </div>

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
        :required="true"
        :endpointPrefix="endpointPrefix"
        :ownerId="ownerId" />
    </div>

    <div class="mb-3" v-if="useDifferentProject || formExpense.project">
      <label for="healthCareCostFormProject" class="form-label me-2">{{ t('labels.project') }}</label>
      <InfoPoint :text="t('info.project')" />
      <button
        type="button"
        class="btn btn-sm btn-link ms-3"
        @click="
          //prettier-ignore
          useDifferentProject = false;
          //@ts-ignore using empty string to reset project as multipart/form-data doesn't sends null
          formExpense.project = ''
        ">
        {{ t('labels.reset') }}
      </button>

      <ProjectSelector id="healthCareCostFormProject" v-model="formExpense.project" />
    </div>
    <div class="mb-2" v-else>
      <button type="button" class="btn btn-link ps-0" @click="useDifferentProject = true">{{ t('labels.useDifferentProject') }}</button>
    </div>

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
import { baseCurrency, Expense } from 'abrechnung-common/types.js'
import { PropType, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CurrencySelector from '@/components/elements/CurrencySelector.vue'
import DateInput from '@/components/elements/DateInput.vue'
import FileUpload from '@/components/elements/FileUpload.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import CTextArea from '@/components/elements/TextArea.vue'

const { t } = useI18n()

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
  showPrevButton: { type: Boolean, default: false },
  showNextButton: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const formExpense = ref(input())
const useDifferentProject = ref(false)
const fileUploadRef = useTemplateRef('fileUpload')

function defaultExpense() {
  return { description: '', cost: { amount: null, currency: baseCurrency, receipts: [], date: '' }, note: undefined, project: undefined }
}
function clear() {
  fileUploadRef.value?.clear()
  formExpense.value = defaultExpense()
  useDifferentProject.value = false
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
