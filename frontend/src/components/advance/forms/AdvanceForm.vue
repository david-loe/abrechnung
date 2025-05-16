<template>
  <form @submit.prevent="disabled ? null : emit(mode as any, output())">
    <div v-if="askOwner" class="mb-3">
      <label for="travelFormOwner" class="form-label"> {{ t('labels.owner') }}<span class="text-danger">*</span> </label>
      <UserSelector v-model="formAdvance.owner" required></UserSelector>
    </div>

    <div class="mb-2">
      <label for="advanceFormName" class="form-label"> {{ t('labels.name') }} </label>
      <input type="text" class="form-control" id="advanceFormName" v-model="formAdvance.name" :disabled="disabled" />
    </div>

    <div class="mb-2">
      <label for="advanceFormReason" class="form-label"> {{ t('labels.reason') }}<span class="text-danger">*</span> </label>
      <input type="text" class="form-control" id="advanceFormReason" v-model="formAdvance.reason" :disabled="disabled" required />
    </div>

    <div class="mb-3">
      <label for="advanceFormBudget" class="form-label me-2"> {{ t('labels.amount') }}<span class="text-danger">*</span> </label>
      <div class="input-group" id="advanceFormBudget">
        <input type="number" class="form-control" step="0.01" v-model="formAdvance.budget.amount" min="0" :disabled="disabled" required />
        <CurrencySelector v-model="formAdvance.budget.currency" :disabled="disabled" :required="true"></CurrencySelector>
      </div>
    </div>

    <div class="mb-3">
      <label for="advanceFormProject" class="form-label me-2"> {{ t('labels.project') }}<span class="text-danger">*</span> </label>
      <InfoPoint :text="t('info.project')" />
      <ProjectSelector id="advanceFormProject" v-model="formAdvance.project" :update-user-org="!askOwner" :disabled="disabled" required>
      </ProjectSelector>
    </div>

    <div class="mb-3" v-if="!disabled">
      <label class="form-label me-2"> {{ t('labels.comment') }} </label>
      <TextArea v-model="formAdvance.comment"></TextArea>
    </div>

    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-primary me-2" v-if="!disabled" :disabled="loading">
        {{ mode === 'add' ? t('labels.addX', { X: t('labels.advance') }) : t('labels.save') }}
      </button>
      <button
        type="button"
        class="btn btn-danger me-2"
        :disabled="loading"
        v-if="mode === 'edit' && !disabled"
        @click="disabled ? null : emit('deleted', (formAdvance as any)._id)">
        {{ t('labels.delete') }}
      </button>
      <span v-if="loading" class="spinner-border spinner-border-sm ms-1 me-3"></span>
      <button type="button" class="btn btn-light" @click="emit('cancel')">
        {{ t('labels.cancel') }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { AdvanceSimple, Project, baseCurrency } from '@/../../common/types.js'
import CurrencySelector from '@/components/elements/CurrencySelector.vue'
import InfoPoint from '@/components/elements/InfoPoint.vue'
import ProjectSelector from '@/components/elements/ProjectSelector.vue'
import TextArea from '@/components/elements/TextArea.vue'
import UserSelector from '@/components/elements/UserSelector.vue'
import { PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  advance: {
    type: Object as PropType<Partial<AdvanceSimple>>,
    required: true
  },
  mode: {
    type: String as PropType<'add' | 'edit'>,
    required: true
  },
  disabled: { type: Boolean, default: false },
  askOwner: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits<{
  cancel: []
  edit: [Partial<AdvanceSimple>]
  add: [Partial<AdvanceSimple>]
  deleted: [string]
}>()

const formAdvance = ref(defaultAdvance())

formAdvance.value = input() as ReturnType<typeof defaultAdvance>

function defaultAdvance() {
  return {
    name: undefined as string | undefined,
    reason: undefined as string | undefined,
    budget: {
      amount: null as number | null,
      currency: baseCurrency
    },
    balance: { amount: null as number | null },
    owner: undefined as string | undefined,
    project: undefined as Project | undefined,
    comment: undefined as string | undefined
  }
}

function input() {
  return { ...defaultAdvance(), ...props.advance }
}

function output() {
  return formAdvance.value as Partial<AdvanceSimple>
}

watch(
  () => props.advance,
  () => {
    formAdvance.value = input() as ReturnType<typeof defaultAdvance>
  }
)
</script>

<style></style>
