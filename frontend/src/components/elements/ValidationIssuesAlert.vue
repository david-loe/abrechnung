<template>
  <div
    v-if="mappedIssues.length > 0"
    :class="'alert ' + (hasErrors ? 'alert-danger' : 'alert-warning') + ' d-flex align-items-start position-relative'"
    role="alert">
    <span :class="'badge rounded-pill position-absolute top-0 end-0 mt-2 me-2 ' + (hasErrors ? 'text-bg-danger' : 'text-bg-warning')">
      {{ mappedIssues.length }}
    </span>
    <div class="w-100 pe-2">
      <div v-for="(issue, index) of visibleIssues" :key="issue.key + index" class="mb-2">
        <div class="d-flex align-items-start">
          <i
            :class="issue.type === 'error' ? 'bi bi-x-octagon-fill text-danger me-2 mt-1' : 'bi bi-info-circle-fill text-warning me-2 mt-1'"></i>
          <div class="flex-grow-1">
            <div v-if="issue.actionPayload" class="mb-1">
              <button type="button" class="btn btn-link btn-sm p-0 text-start fw-semibold" @click="emit('action', issue.actionPayload)">
                <span>{{ issue.subject }}</span>
                <span v-for="(flag, flagIndex) of issue.subjectFlags" :key="flag + flagIndex" class="ms-1">{{ flag }}</span>
              </button>
            </div>
            <div v-else class="mb-1 fw-semibold">
              <span>{{ issue.subject }}</span>
              <span v-for="(flag, flagIndex) of issue.subjectFlags" :key="flag + flagIndex" class="ms-1">{{ flag }}</span>
            </div>
            <div class="d-flex align-items-baseline gap-1">
              <small class="d-block text-body-secondary lh-sm">{{ issue.message }}</small>
              <span v-if="te(`info.${issue.code}`)" class="small lh-1">
                <InfoPoint :text="t(`info.${issue.code}`)" />
              </span>
            </div>
          </div>
        </div>
      </div>
      <button
        v-if="mappedIssues.length > maxVisibleIssues"
        type="button"
        class="btn btn-link btn-sm p-0 mt-1"
        @click="expanded = !expanded">
        {{ expanded ? t('labels.showLess') : t('labels.showAll') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { ValidationResult } from 'abrechnung-common/report/validator.js'
import { computed, type PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import type { ValidationIssueActionPayload } from '@/components/elements/validationIssueTypes'

type ValidationIssuesAlertItem = {
  key: string
  code: string
  type: 'error' | 'warning'
  subject: string
  subjectFlags?: string[]
  message: string
  actionPayload?: ValidationIssueActionPayload
}

type IssueExpense = { description?: string | null }
type IssueStage = { startLocation?: { country?: { flag?: string | null } }; endLocation?: { country?: { flag?: string | null } } }

const props = defineProps({
  results: { type: Array as PropType<ValidationResult[]>, required: true },
  expenses: { type: Array as PropType<IssueExpense[]>, default: () => [] },
  stages: { type: Array as PropType<IssueStage[]>, default: () => [] },
  fallbackSubjectLabelKey: { type: String, default: 'labels.travel' }
})

const emit = defineEmits<(e: 'action', payload: ValidationIssueActionPayload) => void>()

const { t, te } = useI18n()
const maxVisibleIssues = 3
const expanded = ref(false)

function getFieldLabel(path?: string) {
  switch (path) {
    case 'description':
      return t('labels.description')
    case 'cost.amount':
      return t('labels.amount')
    case 'cost.currency':
      return t('labels.currency')
    case 'cost.date':
      return t('labels.date')
    case 'cost.receipts':
      return t('labels.receipts')
    default:
      return path || ''
  }
}

function formatValidationPath(path: string) {
  return path
    .split('.')
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : t(`labels.${part}`)))
    .join(' ➜ ')
}

function formatIssueMessage(result: ValidationResult) {
  if (!result.path) {
    return t(`alerts.${result.code}`)
  }

  const match = result.path.match(/^(stages|expenses)\.\d+\.(.+)$/)
  const fieldPath = match?.[2] || result.path
  const fieldLabel = getFieldLabel(fieldPath)

  if (result.code === 'required' || result.code === 'requiredForReview') {
    return `${fieldLabel} ${t('labels.required')}`
  }

  return t(`alerts.${result.code}`)
}

function getStageIndexes(result: ValidationResult) {
  if (result.reference?.collection === 'stages' && result.reference.index.length > 0) {
    return Array.from(new Set(result.reference.index)).sort((a, b) => a - b)
  }
  const pathMatch = result.path?.match(/^stages\.(\d+)(?:\.|$)/)
  return pathMatch ? [Number(pathMatch[1])] : []
}

function getExpenseIndex(result: ValidationResult) {
  if (result.reference?.collection === 'expenses' && result.reference.index.length > 0) {
    return result.reference.index[0]
  }
  const pathMatch = result.path?.match(/^expenses\.(\d+)(?:\.|$)/)
  return pathMatch ? Number(pathMatch[1]) : undefined
}

function getExpenseSubject(expenseIndex: number) {
  const expenseDescription = props.expenses[expenseIndex]?.description?.trim()
  return expenseDescription || t('labels.expense')
}

function getCountryChangeFlags(result: ValidationResult, stageIndexes: number[]) {
  if (result.code !== 'countryChangeBetweenStages' || stageIndexes.length < 2) {
    return undefined
  }
  const [firstStageIndex, secondStageIndex] = stageIndexes
  const firstFlag = props.stages[firstStageIndex]?.endLocation?.country?.flag
  const secondFlag = props.stages[secondStageIndex]?.startLocation?.country?.flag
  const flags = [firstFlag, secondFlag].filter((flag): flag is string => Boolean(flag))
  return flags.length > 0 ? flags : undefined
}

function getStageSubject(stageIndexes: number[]) {
  return `${t('labels.stage')} ${stageIndexes.map((index) => index + 1).join(' + ')}`
}

function getIssueDisplay(result: ValidationResult) {
  const stageIndexes = getStageIndexes(result)
  if (stageIndexes.length > 1) {
    return {
      subject: getStageSubject(stageIndexes),
      subjectFlags: getCountryChangeFlags(result, stageIndexes),
      actionPayload: { type: 'multi-stage', stageIndexes } as ValidationIssueActionPayload
    }
  }

  if (stageIndexes.length === 1) {
    return {
      subject: getStageSubject(stageIndexes),
      actionPayload: { type: 'single-stage', stageIndex: stageIndexes[0] } as ValidationIssueActionPayload
    }
  }

  const expenseIndex = getExpenseIndex(result)
  if (expenseIndex !== undefined) {
    return {
      subject: getExpenseSubject(expenseIndex),
      actionPayload: { type: 'single-expense', expenseIndex } as ValidationIssueActionPayload
    }
  }

  if (result.code === 'noData.stage') {
    return { subject: t('labels.stage') }
  }
  if (result.code === 'noData.expense') {
    return { subject: t('labels.expense') }
  }
  if (result.path) {
    return { subject: formatValidationPath(result.path) }
  }
  return { subject: t(props.fallbackSubjectLabelKey) }
}

function toIssueItem(result: ValidationResult, index: number): ValidationIssuesAlertItem {
  const { subject, subjectFlags, actionPayload } = getIssueDisplay(result)
  const referenceKey = result.reference ? `${result.reference.collection}:${result.reference.index.join('-')}` : ''
  return {
    key: `${result.code}:${result.path || referenceKey || index}`,
    code: result.code,
    type: result.severity === 'error' ? 'error' : 'warning',
    subject,
    subjectFlags,
    message: formatIssueMessage(result),
    actionPayload
  }
}

const mappedIssues = computed(() => {
  const warnings = props.results
    .filter((result) => result.severity === 'warning' || result.severity === 'info')
    .map((result, index) => toIssueItem(result, index))
  const errors = props.results.filter((result) => result.severity === 'error').map((result, index) => toIssueItem(result, index))
  return [...errors, ...warnings]
})

const hasErrors = computed(() => mappedIssues.value.some((issue) => issue.type === 'error'))
const visibleIssues = computed(() => (expanded.value ? mappedIssues.value : mappedIssues.value.slice(0, maxVisibleIssues)))

watch(
  () => props.results,
  () => {
    expanded.value = false
  }
)
</script>
