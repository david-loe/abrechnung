<template>
  <form @submit.prevent="emit('decision', 'approved', comment, bookingRemark, exchangeRateDate)">
    <Advance :advance="advance" />
    <div v-if="isForeignCurrency" class="mb-3">
      <label for="advanceApprovalExchangeRateDate" class="form-label">
        {{ t('labels.exchangeRateDate') }}
        <span class="text-danger">*</span>
      </label>
      <DateInput
        id="advanceApprovalExchangeRateDate"
        :model-value="exchangeRateDate || undefined"
        :max="new Date()"
        required
        @update:model-value="(date) => (exchangeRateDate = date)" />
    </div>
    <div class="mb-3">
      <label for="comment" class="form-label">{{ t('labels.comment') }}</label>
      <CTextArea id="comment" v-model="comment" />
    </div>

    <div class="mb-3">
      <label for="bookingRemark" class="form-label">{{ t('labels.bookingRemark') }}</label>
      <CTextArea id="bookingRemark" v-model="bookingRemark" />
    </div>
    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-success me-2" :disabled="loading">
        {{ t('labels.approve') }}
      </button>
      <button type="button" class="btn btn-danger me-2" @click="emit('decision', 'rejected', comment, bookingRemark)" :disabled="loading">
        {{ t('labels.reject') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="emit('cancel')">{{ t('labels.cancel') }}</button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import { AdvanceSimple, baseCurrency, idDocumentToId } from 'abrechnung-common/types.js'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Advance from '@/components/advance/Advance.vue'
import DateInput from '@/components/elements/DateInput.vue'
import CTextArea from '@/components/elements/TextArea.vue'

const { t } = useI18n()

const props = defineProps<{ advance: AdvanceSimple<string>; loading: boolean }>()
const comment = ref(undefined as string | null | undefined)
const bookingRemark = ref(undefined as string | null | undefined)
const exchangeRateDate = ref<Date | string | null>(props.advance.exchangeRateDate || new Date())
const isForeignCurrency = computed(() => idDocumentToId(props.advance.budget.currency) !== baseCurrency._id)

const emit = defineEmits<{
  decision: [
    decision: 'approved' | 'rejected',
    comment: string | null | undefined,
    bookingRemark: string | null | undefined,
    exchangeRateDate?: Date | string | null
  ]
  cancel: []
}>()

watch(
  () => props.advance,
  () => {
    comment.value = undefined
    bookingRemark.value = undefined
    exchangeRateDate.value = props.advance.exchangeRateDate || new Date()
  }
)
</script>

<style></style>
