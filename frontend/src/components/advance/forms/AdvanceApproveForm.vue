<template>
  <div>
    <Advance :advance="advance"></Advance>
    <div class="mb-3">
      <label for="comment" class="form-label">{{ t('labels.comment') }}</label>
      <TextArea id="comment" v-model="comment"></TextArea>
    </div>

    <div class="mb-3">
      <label for="bookingRemark" class="form-label">{{ t('labels.bookingRemark') }}</label>
      <TextArea id="bookingRemark" v-model="bookingRemark"></TextArea>
    </div>
    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-success me-2" @click="emit('decision', 'approved', comment, bookingRemark)" :disabled="loading">
        {{ $t('labels.approve') }}
      </button>
      <button type="button" class="btn btn-danger me-2" @click="emit('decision', 'rejected', comment, bookingRemark)" :disabled="loading">
        {{ $t('labels.reject') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AdvanceSimple } from '@/../../common/types.js'
import Advance from '@/components/advance/Advance.vue'
import TextArea from '@/components/elements/TextArea.vue'

const { t } = useI18n()

const props = defineProps<{ advance: AdvanceSimple<string>; loading: boolean }>()
const comment = ref(undefined as string | null | undefined)
const bookingRemark = ref(undefined as string | null | undefined)

const emit = defineEmits<{ decision: ['approved' | 'rejected', string | null | undefined, string | null | undefined]; cancel: [] }>()

watch(
  () => props.advance,
  () => {
    comment.value = undefined
    bookingRemark.value = undefined
  }
)
</script>

<style></style>
