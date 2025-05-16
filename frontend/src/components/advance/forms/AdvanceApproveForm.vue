<template>
  <div>
    <Advance :advance="advance"></Advance>
    <div class="mb-3">
      <label for="comment" class="form-label">{{ $t('labels.comment') }}</label>
      <TextArea id="comment" v-model="comment"></TextArea>
    </div>
    <div class="mb-1 d-flex align-items-center">
      <button type="submit" class="btn btn-success me-2" @click="emit('decision', 'approved', comment)" :disabled="loading">
        {{ $t('labels.approve') }}
      </button>
      <button type="button" class="btn btn-danger me-2" @click="emit('decision', 'rejected', comment)" :disabled="loading">
        {{ $t('labels.reject') }}
      </button>
      <button type="button" class="btn btn-light" v-on:click="emit('cancel')">
        {{ $t('labels.cancel') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AdvanceSimple } from '@/../../common/types.js'
import Advance from '@/components/advance/Advance.vue'
import TextArea from '@/components/elements/TextArea.vue'
import { ref, watch } from 'vue'

const props = defineProps<{ advance: AdvanceSimple; loading: boolean }>()
const comment = ref('')

const emit = defineEmits<{ decision: ['approved' | 'rejected', string]; cancel: [] }>()

watch(
  () => props.advance,
  () => {
    comment.value = ''
  }
)
</script>

<style></style>
