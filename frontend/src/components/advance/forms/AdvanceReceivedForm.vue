<template>
  <form @submit.prevent="submit">
    <div class="form-check mb-3">
      <input
        class="form-check-input"
        type="checkbox"
        id="advanceReceivedCheck"
        v-model="confirmed"
        :disabled="loading" />
      <label class="form-check-label" for="advanceReceivedCheck">
        {{ t('labels.advanceReceiptConfirmation', { amount: formatter.money(props.advance.budget) }) }}
      </label>
    </div>
    <div class="mb-3">
      <label class="form-label" for="advanceReceivedOn">{{ t('labels.receivedOn') }}</label>
      <DateInput id="advanceReceivedOn" v-model="receivedOn" :disabled="loading" required />
    </div>
    <button type="submit" class="btn btn-primary me-2" :disabled="loading || !confirmed">
      {{ t('labels.confirm') }}
    </button>
    <button type="button" class="btn btn-light" @click="emit('cancel')" :disabled="loading">
      {{ t('labels.cancel') }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { AdvanceSimple } from 'abrechnung-common/types.js'
import { PropType, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import DateInput from '@/components/elements/DateInput.vue'
import { formatter } from '@/formatter.js'

const { t } = useI18n()

const props = defineProps({
  advance: { type: Object as PropType<AdvanceSimple<string>>, required: true },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits<{ confirm: [Date | string]; cancel: [] }>()

const confirmed = ref(false)
const receivedOn = ref<Date | string>(props.advance.receivedOn ?? new Date())

watch(
  () => props.advance,
  (advance) => {
    confirmed.value = false
    receivedOn.value = advance.receivedOn ?? new Date()
  }
)

function submit() {
  emit('confirm', receivedOn.value)
}
</script>

<style></style>
