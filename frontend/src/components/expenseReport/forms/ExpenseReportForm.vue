<template>
  <form class="container" @submit.prevent="emit(mode as 'add', output())">
    <div v-if="!owner" class="mb-3">
      <label for="expenseReportFormOwner" class="form-label">
        {{ t('labels.owner') }}
        <span class="text-danger">*</span>
      </label>
      <UserSelector v-model="formExpenseReport.owner" required />
    </div>

    <div class="mb-3">
      <label for="expenseReportFormName" class="form-label">{{ t('labels.expenseReportName') }}</label>
      <input type="text" class="form-control" id="expenseReportFormName" v-model="formExpenseReport.name" >
    </div>

    <div v-if="APP_DATA?.categories && APP_DATA?.categories.length > 1" class="mb-3">
      <label for="expenseReportFormCategory" class="form-label">
        {{ t('labels.category') }}
        <span class="text-danger">*</span>
      </label>
      <CategorySelector v-model="formExpenseReport.category" id="expenseReportFormCategory" required />
    </div>

    <div class="mb-3">
      <label for="expenseReportFormProject" class="form-label me-2">
        {{ t('labels.project') }}
        <span class="text-danger">*</span>
      </label>
      <InfoPoint :text="t('info.project')" />
      <ProjectSelector id="expenseReportFormProject" v-model="formExpenseReport.project" :update-user-org="updateUserOrg" required />
    </div>

    <div class="mb-3" v-if="APP_DATA?.settings.disableReportType.advance === false">
      <label for="expenseReportFormAdvance" class="form-label me-2">{{ t('labels.advanceFromEmployer') }}</label>
      <InfoPoint :text="t('info.advance')" />
      <AdvanceSelector
        id="expenseReportFormAdvance"
        v-model="formExpenseReport.advances"
        :owner="formExpenseReport.owner"
        :project="formExpenseReport.project"
        :setDefault="APP_DATA.settings.autoSelectAvailableAdvances"
        :endpoint-prefix="endpointPrefix"
        multiple />
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" :disabled="loading">
        {{ mode === 'add' ? t('labels.addX', { X: t('labels.expenseReport') }) : t('labels.save') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" v-on:click="emit('cancel')">{{ t('labels.cancel') }}</button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { ExpenseReportSimple, UserSimple } from 'abrechnung-common/types.js'
import { PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdvanceSelector from '@/components/elements/AdvanceSelector.vue'
import CategorySelector from '@/components/elements/CategorySelector.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import APP_LOADER from '@/dataLoader.js'

const { t } = useI18n()

const emit = defineEmits<{ cancel: []; edit: [Partial<ExpenseReportSimple<string>>]; add: [Partial<ExpenseReportSimple<string>>] }>()

const props = defineProps({
  expenseReport: { type: Object as PropType<Partial<ExpenseReportSimple<string>>>, required: true },
  mode: { type: String as PropType<'add' | 'edit'>, required: true },
  owner: { type: Object as PropType<UserSimple<string>> },
  updateUserOrg: { type: Boolean, default: false },
  endpointPrefix: { type: String, default: '' },
  loading: { type: Boolean, default: false }
})
const APP_DATA = APP_LOADER.data
const formExpenseReport = ref(input())

function defaultExpenseReport() {
  return { name: '', advances: [], owner: props.owner, category: APP_DATA.value?.defaultCategory }
}
function output() {
  return formExpenseReport.value
}
function input() {
  return { ...defaultExpenseReport(), ...props.expenseReport }
}

await APP_LOADER.loadData()

watch(
  () => props.expenseReport,
  () => {
    formExpenseReport.value = input()
  }
)
</script>

<style></style>
