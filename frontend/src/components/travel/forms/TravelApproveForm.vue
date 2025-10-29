<template>
  <div>
    <TravelApply :travel="travel" />
    <div class="mb-3">
      <label for="comment" class="form-label">{{ t('labels.comment') }}</label>
      <CTextArea id="comment" v-model="comment" />
    </div>
    <div class="mb-2">
      <button type="submit" class="btn btn-success me-2" @click="output('approved')" :disabled="loading.approved || loading.rejected">
        <span v-if="loading.approved" class="spinner-border spinner-border-sm"></span>
        {{ t('labels.approve') }}
      </button>
      <button type="button" class="btn btn-danger me-2" @click="output('rejected')" :disabled="loading.approved || loading.rejected">
        <span v-if="loading.rejected" class="spinner-border spinner-border-sm"></span>
        {{ t('labels.reject') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="emit('cancel')">{{ t('labels.cancel') }}</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { TravelSimple } from 'abrechnung-common/types.js'
import { PropType, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CTextArea from '@/components/elements/TextArea.vue'
import TravelApply from '@/components/travel/elements/TravelApplication.vue'

const { t } = useI18n()

type Decision = 'approved' | 'rejected'
const comment = ref('')
const loading = ref({ approved: false, rejected: false })

const props = defineProps({ travel: { type: Object as PropType<TravelSimple>, required: true } })
const emit = defineEmits<{ decision: [Decision, string]; cancel: [] }>()

function output(decision: 'approved' | 'rejected') {
  loading.value[decision] = true
  emit('decision', decision, comment.value)
}
</script>

<style></style>
