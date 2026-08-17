<template>
  <div class="mb-3">
    <div v-if="modelValue.length !== 1" class="d-flex align-items-center mb-2">
      <label class="form-label mb-0">{{ t('labels.position') }} <span v-if="required || ownCar" class="text-danger">*</span></label>
      <button v-if="!disabled && !ownCar" type="button" class="btn btn-sm btn-outline-secondary ms-auto" @click="addPosition">
        <i class="bi bi-plus-lg"></i> {{ t('labels.add') }}
      </button>
    </div>
    <div
      v-for="(position, index) in modelValue"
      :key="position._id || index"
      :class="modelValue.length > 1 ? 'border rounded p-3 mb-2' : 'mb-2'">
      <div class="row g-2 position-relative">
        <div v-if="positionDescriptionRequired(position)" :class="canRemovePosition(position) ? 'col-md-5' : 'col-md-6'">
          <label class="form-label">{{ t('labels.description') }} <span class="text-danger">*</span></label>
          <input v-model="position.description" type="text" class="form-control" required :disabled="disabled" @change="changed" >
        </div>
        <div :class="amountColumn(position)">
          <label class="form-label">
            {{ t('labels.amount') }}<template v-if="vatEnabled(position)"> ({{ t('labels.grossAmount') }})</template>
            <span v-if="amountRequired" class="text-danger">*</span>
          </label>
          <input
            v-model.number="position.grossAmount"
            type="number"
            step="0.01"
            class="form-control tnum"
            :required="amountRequired"
            :disabled="disabled || position.kind === 'ownCar'"
            @change="amountChanged(position)" >
        </div>
        <div v-if="vatEnabled(position)" class="col-md-3">
          <label class="form-label">{{ t('labels.vatRate') }} <span class="text-danger">*</span></label>
          <select v-model.number="position.vatRate" class="form-select" required :disabled="disabled" @change="vatRateChanged(position)">
            <option v-for="rate in vatRates(position)" :key="rate" :value="rate">{{ rate }} %</option>
          </select>
        </div>
        <div v-if="canRemovePosition(position)" class="position-absolute top-0 end-0 w-auto">
          <button type="button" class="btn btn-sm btn-outline-danger" :title="t('labels.delete')" @click="removePosition(index)">
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <div class="col-md-6">
          <label class="form-label">{{ t('labels.project') }} <span class="text-danger">*</span></label>
          <ProjectSelector
            :model-value="position.project"
            :disabled="disabled"
            @update:model-value="(project) => setProject(position, project)" />
        </div>
        <div class="col-md-6">
          <label class="form-label">{{ t('labels.category') }} <span class="text-danger">*</span></label>
          <CategorySelector v-model="position.category" :report-type="reportType" :disabled="disabled" required @update:model-value="changed" />
        </div>
      </div>
      <div v-if="vatEnabled(position)" class="d-flex align-items-center gap-1 mt-2">
        <small class="text-secondary tnum"> {{ t('labels.netAmount') }}: {{ money(getCostPositionNetAmount(position, true)) }} · </small>
        <template v-if="editedVatPosition === position">
          <label class="visually-hidden" :for="`vatAmount-${position._id || index}`">{{ t('labels.vatAmount') }}</label>
          <div class="input-group input-group-sm w-auto">
            <span class="input-group-text">{{ t('labels.vatAmount') }}</span>
            <input
              :id="`vatAmount-${position._id || index}`"
              v-model.number="vatAmountDraft"
              type="number"
              step="0.01"
              :min="Math.min(0, position.grossAmount)"
              :max="Math.max(0, position.grossAmount)"
              class="form-control tnum"
              required
              @change="saveVatAmountOverride(position)" >
          </div>
          <button type="button" class="btn btn-sm btn-link py-0" @click="resetVatAmountOverride(position)">{{ t('labels.reset') }}</button>
        </template>
        <template v-else>
          <small class="text-secondary tnum">{{ t('labels.vatAmount') }}: {{ money(getCostPositionVatAmount(position, true)) }}</small>
          <button
            v-if="!disabled && position.vatRate !== 0"
            type="button"
            class="btn btn-sm btn-link py-0"
            @click="editVatAmount(position)">
            {{ t('labels.edit') }}
          </button>
        </template>
      </div>
    </div>
    <button
      v-if="modelValue.length === 1 && !disabled && !ownCar"
      type="button"
      class="btn btn-sm btn-link px-0"
      @click="addPosition">
      {{ t('labels.addX', { X: t('labels.position') }) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { Category, CostPosition, Currency, idDocumentToId, ProjectSimple } from 'abrechnung-common/types.js'
import { getCostPositionNetAmount, getCostPositionVatAmount } from 'abrechnung-common/utils/scripts.js'
import { PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import APP_LOADER from '@/dataLoader.js'
import { formatter } from '@/formatter.js'
import CategorySelector from './CategorySelector.vue'
import ProjectSelector from './ProjectSelector.vue'

const { t } = useI18n()
const APP_DATA = APP_LOADER.data
const props = defineProps({
  modelValue: { type: Array as PropType<CostPosition<string>[]>, required: true },
  defaultProject: { type: Object as PropType<ProjectSimple<string>>, required: true },
  reportType: { type: String as PropType<'Travel' | 'ExpenseReport'>, required: true },
  disabled: { type: Boolean, default: false },
  ownCar: { type: Boolean, default: false },
  currency: { type: Object as PropType<Currency>, required: true },
  required: { type: Boolean, default: true },
  amountRequired: { type: Boolean, default: true },
  requireSinglePositionDescription: { type: Boolean, default: true }
})
const emit = defineEmits<{ 'update:modelValue': [CostPosition<string>[]] }>()
const editedVatPosition = ref<CostPosition<string>>()
const vatAmountDraft = ref(0)

function defaultCategory() {
  const categories = APP_DATA.value?.categories.filter(({ for: value }) => value === 'both' || value === props.reportType) ?? []
  return categories.find(({ isDefault }) => isDefault) ?? (categories.length === 1 ? categories[0] : undefined)
}

function createPosition(kind: CostPosition['kind'] = 'manual') {
  return {
    kind,
    ...(kind === 'manual' ? { description: '' } : {}),
    grossAmount: 0,
    vatRate: 0,
    project: props.defaultProject,
    category: defaultCategory() as Category<string>
  }
}

function ensurePosition() {
  if (props.modelValue.length === 0 && (props.required || props.ownCar)) {
    emit('update:modelValue', [createPosition(props.ownCar ? 'ownCar' : 'manual')])
    return
  }
  let changedPosition = false
  const positions = props.modelValue.map((position) => {
    const category = position.category ?? defaultCategory()
    const vatRate = position.kind === 'ownCar' || !vatRates(position).includes(position.vatRate) ? 0 : position.vatRate
    const clearVatOverride = typeof position.vatAmountOverride === 'number' && (!vatEnabled(position) || vatRate === 0)
    if (category === position.category && vatRate === position.vatRate && !clearVatOverride) return position
    changedPosition = true
    const normalizedPosition = { ...position, category: category as Category<string>, vatRate }
    if (clearVatOverride) delete normalizedPosition.vatAmountOverride
    return normalizedPosition
  })
  if (changedPosition) emit('update:modelValue', positions)
}

function changed() {
  emit('update:modelValue', [...props.modelValue])
}
function amountChanged(position: CostPosition<string>) {
  if (!props.amountRequired && !Number.isFinite(position.grossAmount)) position.grossAmount = 0
  clearVatAmountOverride(position)
  changed()
}
function vatRateChanged(position: CostPosition<string>) {
  clearVatAmountOverride(position)
  changed()
}
function editVatAmount(position: CostPosition<string>) {
  editedVatPosition.value = position
  vatAmountDraft.value = getCostPositionVatAmount(position, true)
}
function saveVatAmountOverride(position: CostPosition<string>) {
  position.vatAmountOverride = vatAmountDraft.value
  changed()
}
function resetVatAmountOverride(position: CostPosition<string>) {
  clearVatAmountOverride(position)
  changed()
}
function clearVatAmountOverride(position: CostPosition<string>) {
  delete position.vatAmountOverride
  if (editedVatPosition.value === position) editedVatPosition.value = undefined
}
function addPosition() {
  emit('update:modelValue', [...props.modelValue, createPosition()])
}
function removePosition(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, positionIndex) => positionIndex !== index))
}
function canRemovePosition(position: CostPosition<string>) {
  return !props.disabled && position.kind === 'manual' && (props.modelValue.length > 1 || !props.required)
}
function positionDescriptionRequired(position: CostPosition<string>) {
  return position.kind === 'manual' && (props.requireSinglePositionDescription || props.modelValue.length > 1)
}
function amountColumn(position: CostPosition<string>) {
  if (positionDescriptionRequired(position)) return 'col-md-3'
  if (canRemovePosition(position)) return vatEnabled(position) ? 'col-md-8' : 'col-md-11'
  return vatEnabled(position) ? 'col-md-9' : 'col-md-12'
}
function organisation(position: CostPosition<string>) {
  const projectOrganisation = idDocumentToId(position.project.organisation).toString()
  return APP_DATA.value?.organisations.find(({ _id }) => _id === projectOrganisation)
}
function vatEnabled(position: CostPosition<string>) {
  return position.kind !== 'ownCar' && Boolean(organisation(position)?.accountingSettings.vatAccountingEnabled)
}
function vatRates(position: CostPosition<string>) {
  return organisation(position)?.accountingSettings.vatRates.map(({ rate }) => rate) ?? [0]
}
function setProject(position: CostPosition<string>, project: ProjectSimple<string>) {
  position.project = project
  if (position.kind === 'ownCar' || !vatRates(position).includes(position.vatRate)) {
    position.vatRate = 0
    clearVatAmountOverride(position)
  } else if (!vatEnabled(position)) {
    clearVatAmountOverride(position)
  }
  changed()
}
function money(amount: number) {
  return formatter.currency(amount, props.currency._id)
}

watch(() => props.modelValue, ensurePosition, { immediate: true })
</script>
